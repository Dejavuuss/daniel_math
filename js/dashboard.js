const session = requireAuth();

(async function init() {
  if (!session) return;

  document.getElementById("greeting").textContent = `Привет, ${session.name}!`;
  document.getElementById("logoutBtn").onclick = logout;
  if (session.role === "admin") document.getElementById("adminLink").hidden = false;

  // вкладки
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
    };
  });

  let materials = [], homework = [], schedule = [];
  try {
    [materials, homework, schedule] = await Promise.all([
      loadJSON("data/materials.json"),
      loadJSON("data/homework.json"),
      loadJSON("data/schedule.json")
    ]);
  } catch (e) {
    document.getElementById("materials").innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
    return;
  }

  renderMaterials(materials);
  const myHomework = homework.filter(h => h.student === session.login);
  renderHomework(myHomework);

  // события календаря: общие + индивидуальные + дедлайны ДЗ ученика
  const events = schedule
    .filter(ev => !ev.student || ev.student === session.login)
    .concat(myHomework.map(h => ({ date: h.due, type: "deadline", title: "Дедлайн ДЗ: " + h.title })));
  renderCalendar(document.getElementById("calendar"), events);
})();

function renderMaterials(all) {
  const box = document.getElementById("materials");
  // ученик видит материалы своего класса и общие (без grade); админ — все
  const list = session.role === "admin" ? all : all.filter(m => !m.grade || m.grade === session.grade);
  if (!list.length) { box.innerHTML = `<p class="muted">Пока материалов нет.</p>`; return; }
  box.innerHTML = list.map(m => `
    <div class="item">
      <div class="row">
        <h3>📄 ${escapeHtml(m.title)}</h3>
        ${m.grade ? `<span class="badge">${m.grade} класс</span>` : ""}
      </div>
      <div class="muted">${escapeHtml(m.description || "")}</div>
      ${m.url ? `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">Открыть материал →</a>` : ""}
    </div>`).join("");
}

// Статус «сделано» ученик отмечает у себя в браузере (localStorage).
// Репетитор может поставить "done" в homework.json — это имеет приоритет.
function doneKey() { return "tutor_done_" + session.login; }
function getDoneSet() {
  try { return new Set(JSON.parse(localStorage.getItem(doneKey()) || "[]")); } catch (e) { return new Set(); }
}

function renderHomework(list) {
  const box = document.getElementById("homework");
  if (!list.length) { box.innerHTML = `<p class="muted">Домашних заданий пока нет 🎉</p>`; return; }
  const done = getDoneSet();
  const today = new Date().toISOString().slice(0, 10);

  box.innerHTML = list
    .slice().sort((a, b) => a.due.localeCompare(b.due))
    .map(h => {
      const isDone = h.status === "done" || done.has(h.id);
      const overdue = !isDone && h.due < today;
      const badge = isDone ? `<span class="badge done">✅ сделано</span>`
        : overdue ? `<span class="badge overdue">⏰ просрочено</span>`
        : `<span class="badge pending">⏳ не сделано</span>`;
      return `<div class="item">
        <div class="row"><h3>📝 ${escapeHtml(h.title)}</h3>${badge}</div>
        <div class="muted">Выдано: ${escapeHtml(h.assigned)} · Дедлайн: ${escapeHtml(h.due)}</div>
        ${h.status === "done" ? "" : `<label class="check"><input type="checkbox" data-id="${h.id}" ${isDone ? "checked" : ""}> Отметить как сделанное</label>`}
      </div>`;
    }).join("");

  box.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.onchange = () => {
      const set = getDoneSet();
      cb.checked ? set.add(+cb.dataset.id) : set.delete(+cb.dataset.id);
      localStorage.setItem(doneKey(), JSON.stringify([...set]));
      renderHomework(list);
    };
  });
}
