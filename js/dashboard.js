const currentUser = requireAuth();
let state = { users:[], materials:[], homework:[], schedule:[], settings:{} };
document.getElementById("logoutBtn").onclick = logout;
if (currentUser) {
  document.getElementById("greeting").textContent = `Привет, ${currentUser.name}!`;
  if (currentUser.role === "admin") document.getElementById("adminLink").hidden = false;
}
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
}));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
async function loadData() {
  document.getElementById("loadStatus").textContent = "Обновляем данные…";
  try {
    state = await apiGet();
    renderMaterials();
    renderHomework();
    const events = state.schedule.filter(ev => !ev.student || ev.student === currentUser.username);
    const myHw = state.homework.filter(h => h.student === currentUser.username);
    events.push(...myHw.filter(h => h.due).map(h => ({date:String(h.due).slice(0,10),time:"",type:"deadline",title:"Дедлайн ДЗ: "+h.title,description:""})));
    renderCalendar(document.getElementById("calendar"), events);
    document.getElementById("loadStatus").textContent = "Данные синхронизированы с Google Sheets";
  } catch (e) { document.getElementById("loadStatus").textContent = "Ошибка: " + e.message; }
}
function renderMaterials() {
  const list = state.materials.filter(m => currentUser.role === "admin" || !m.grade || String(m.grade) === String(currentUser.grade));
  const box = document.getElementById("materials");
  box.innerHTML = list.length ? list.map(m => `<article class="item"><div class="row"><h3>📄 ${esc(m.title)}</h3>${m.grade ? `<span class="badge">${esc(m.grade)} класс</span>` : '<span class="badge">Для всех</span>'}</div><p class="muted">${esc(m.description || "")}</p>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Открыть материал ↗</a>` : ""}</article>`).join("") : '<p class="muted">Материалов пока нет.</p>';
}
function renderHomework() {
  const list = state.homework.filter(h => currentUser.role === "admin" || h.student === currentUser.username);
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const box = document.getElementById("homework");
  box.innerHTML = list.length ? list.slice().sort((a,b)=>String(a.due).localeCompare(String(b.due))).map(h => {
    const done = h.status === "done", overdue = !done && String(h.due).slice(0,10) < today;
    const badge = done ? '<span class="badge done">✓ Сделано</span>' : overdue ? '<span class="badge overdue">Просрочено</span>' : '<span class="badge pending">В работе</span>';
    return `<article class="item"><div class="row"><h3>📝 ${esc(h.title)}</h3>${badge}</div><p class="muted">Выдано: ${esc(String(h.assigned).slice(0,10))} · Дедлайн: ${esc(String(h.due).slice(0,10))}</p>${currentUser.role !== "admin" ? `<button class="${done?'':'primary'}" data-homework="${esc(h.id)}" data-status="${done?'pending':'done'}">${done?'Отменить отметку':'✓ Отметить выполненным'}</button>` : `<span class="muted">Ученик: ${esc(h.student)}</span>`}</article>`;
  }).join("") : '<p class="muted">Домашних заданий пока нет 🎉</p>';
  box.querySelectorAll("[data-homework]").forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.homework, item = state.homework.find(h => String(h.id) === String(id));
    if (!item) return;
    const old = item.status, next = btn.dataset.status;
    item.status = next; renderHomework(); // оптимистично обновляем интерфейс
    try { await apiPost({action:"updateHomeworkStatus", homeworkId:id, status:next}); }
    catch(e) { item.status = old; renderHomework(); alert("Не удалось сохранить статус: " + e.message); }
  });
}
loadData();
