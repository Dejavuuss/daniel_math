const currentUser = requireAuth();
if (currentUser && currentUser.role === "parent") location.replace("parent.html");
let state = { users:[], materials:[], homework:[], schedule:[], grades:[], lessonNotes:[], achievements:[], messages:[], settings:{} };

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
        renderLessonNotes();
        renderProgressChart();
        renderAchievements();
        renderDeadlines();
        renderMessages();
        const events = state.schedule.filter(ev => !ev.student || ev.student === currentUser.username);
        const myHw = state.homework.filter(h => h.student === currentUser.username);
        events.push(...myHw.filter(h => h.due).map(h => ({date:String(h.due).slice(0,10),time:"",type:"deadline",title:"Дедлайн: "+h.title,description:""})));
        renderCalendar(document.getElementById("calendar"), events);
        document.getElementById("loadStatus").textContent = "● Данные синхронизированы";
        updateStats();
    } catch (e) { document.getElementById("loadStatus").textContent = "Ошибка: " + e.message; }
}

function updateStats() {
    const mine = state.homework.filter(h => currentUser.role === "admin" || h.student === currentUser.username);
    const pending = mine.filter(h => h.status !== "done").length;
    const avgGrade = state.grades.length ? (state.grades.reduce((s,g)=>s+Number(g.grade||0),0)/state.grades.length).toFixed(2) : '—';
    document.getElementById("dashboardStats").innerHTML = `
        <article class="stat-card"><span class="eyebrow">ВСЕГО ЗАДАНИЙ</span><strong>${mine.length}</strong><span class="muted small">в твоём списке</span></article>
        <article class="stat-card"><span class="eyebrow">ОСТАЛОСЬ</span><strong>${pending}</strong><span class="muted small">нужно выполнить</span></article>
        <article class="stat-card"><span class="eyebrow">СРЕДНИЙ БАЛЛ</span><strong>${avgGrade}</strong><span class="muted small">из 5.0</span></article>
        <article class="stat-card"><span class="eyebrow">ДОСТИЖЕНИЙ</span><strong>${state.achievements.length}</strong><span class="muted small">получено</span></article>`;
}

function renderProgressChart() {
    const box = document.getElementById("progressChart");
    const grades = state.grades.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10);
    if (!grades.length) { box.innerHTML = '<p class="muted" style="text-align:center;width:100%">Нет оценок</p>'; return; }
    box.innerHTML = grades.map(g => {
        const h = (Number(g.grade) / 5) * 100;
        return `<div class="progress-bar" style="height:${h}%" data-label="${esc(g.grade)}" title="${esc(g.subject)} ${esc(g.date)}"></div>`;
    }).join("");
}

function renderAchievements() {
    const box = document.getElementById("achievementsList");
    const mine = state.achievements.filter(a => a.student === currentUser.username);
    if (!mine.length) { box.innerHTML = '<p class="muted small">Пока нет достижений</p>'; return; }
    box.innerHTML = mine.slice(-6).map(a => `<div class="achievement"><div class="achievement-icon">${esc(a.icon||'🏆')}</div><div class="achievement-title">${esc(a.title)}</div><div class="achievement-desc">${esc(a.date)}</div></div>`).join("");
}

function renderDeadlines() {
    const box = document.getElementById("deadlinesList");
    const today = new Date().toISOString().slice(0,10);
    const upcoming = state.homework
        .filter(h => h.student === currentUser.username && h.status !== "done" && String(h.due).slice(0,10) >= today)
        .sort((a,b)=>String(a.due).localeCompare(String(b.due)))
        .slice(0,5);
    if (!upcoming.length) { box.innerHTML = '<p class="muted small">Нет активных дедлайнов 🎉</p>'; return; }
    box.innerHTML = upcoming.map(h => {
        const days = Math.ceil((new Date(h.due) - new Date()) / 86400000);
        const badge = days <= 1 ? 'danger' : days <= 3 ? 'pending' : 'info';
        return `<div class="item" style="padding:10px 0"><div class="row"><span>${esc(h.title)}</span><span class="badge ${badge}">${days === 0 ? 'Сегодня' : days+' дн'}</span></div></div>`;
    }).join("");
}

async function renderMessages() {
    const box = document.getElementById("messagesList");
    const mine = state.messages.filter(m => m.to === currentUser.username || m.from === currentUser.username).slice(-5);
    const unread = mine.filter(m => m.to === currentUser.username && m.isRead !== 'true').length;
    const badge = document.getElementById("unreadBadge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = 'inline-block'; } else { badge.style.display = 'none'; }
    if (!mine.length) { box.innerHTML = '<p class="muted small">Сообщений нет</p>'; return; }
    box.innerHTML = mine.slice().reverse().map(m => `<div class="message ${m.from===currentUser.username?'outgoing':''} ${m.isRead==='true'?'':'unread'}"><div class="message-meta">${m.from===currentUser.username?'Кому: '+esc(m.to):'От: '+esc(m.from)} · ${esc(m.date)}</div><div class="message-text">${esc(m.text)}</div></div>`).join("");
    if (unread > 0) {
        try { await apiPost({action:"markMessagesRead"}); } catch(e) {}
    }
}

function renderLessonNotes() {
    const box = document.getElementById("lessonNotes");
    const mine = state.lessonNotes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if (!mine.length) { box.innerHTML = '<p class="muted">Заметок с занятий пока нет.</p>'; return; }
    box.innerHTML = mine.map(n => `
        <div class="lesson-note">
            <div class="lesson-note-header">
                <span class="lesson-note-topic">${esc(n.topic)}</span>
                <span class="lesson-note-meta">${esc(n.date)} · ${esc(n.duration)} мин · <span class="lesson-note-rating">${'★'.repeat(Number(n.rating)||0)}${'☆'.repeat(5-(Number(n.rating)||0))}</span></span>
            </div>
            <div class="lesson-note-text">${esc(n.note)}</div>
        </div>`).join("");
}

function renderMaterials() {
    const list = state.materials.filter(m => currentUser.role === "admin" || !m.grade || String(m.grade) === String(currentUser.grade));
    const box = document.getElementById("materials");
    box.innerHTML = list.length ? list.map(m => `<article class="item"><div class="row"><h3>📄 ${esc(m.title)}</h3>${m.grade ? `<span class="badge">${esc(m.grade)} кл</span>` : '<span class="badge">Для всех</span>'}</div>${m.topic?`<p class="muted small">📚 ${esc(m.topic)}</p>`:''}<p class="muted">${esc(m.description || "")}</p>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть ↗</a>` : ""}</article>`).join("") : '<p class="muted">Материалов пока нет.</p>';
}

function renderHomework() {
    const list = state.homework.filter(h => currentUser.role === "admin" || h.student === currentUser.username);
    const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const box = document.getElementById("homework");
    box.innerHTML = list.length ? list.slice().sort((a,b)=>String(a.due).localeCompare(String(b.due))).map(h => {
        const done = h.status === "done", overdue = !done && String(h.due).slice(0,10) < today;
        const badge = done ? '<span class="badge done">✓ Сделано</span>' : overdue ? '<span class="badge overdue">Просрочено</span>' : '<span class="badge pending">В работе</span>';
        return `<article class="item"><div class="row"><h3>📝 ${esc(h.title)}</h3>${badge}</div>${h.comment?`<p class="muted small">${esc(h.comment)}</p>`:''}<p class="muted">Выдано: ${esc(String(h.assigned).slice(0,10))} · Дедлайн: ${esc(String(h.due).slice(0,10))}</p>${h.link ? `<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">▶ Открыть материал ↗</a>` : ""}${currentUser.role !== "admin" ? `<button class="${done?'':'primary'}" style="margin-top:10px" data-homework="${esc(h.id)}" data-status="${done?'pending':'done'}">${done?'Снять отметку':'✓ Выполнено'}</button>` : `<span class="muted">Ученик: ${esc(h.student)}</span>`}</article>`;
    }).join("") : '<p class="muted">Домашних заданий пока нет 🎉</p>';
    box.querySelectorAll("[data-homework]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.homework, item = state.homework.find(h => String(h.id) === String(id));
        if (!item) return;
        const old = item.status, next = btn.dataset.status;
        item.status = next; renderHomework(); updateStats();
        try { await apiPost({action:"updateHomeworkStatus", homeworkId:id, status:next}); }
        catch(e) { item.status = old; renderHomework(); updateStats(); alert("Ошибка: " + e.message); }
    });
}

loadData();