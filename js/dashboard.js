import { requireAuth, apiGet, apiPost, logout, today } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { mountArt, QUOTES } from "./art.js";
import { esc, byDate, fmtDate, daysUntil, average, showToast, setStatus, initTabs, mountStats, gradeBars, medallions, noteHtml, messageHtml } from "./ui.js";
import { renderCalendar } from "./calendar.js";
import { attachmentsHtml, bindAttachments, bindSolutionUploads, solutionButtonHtml, filesFor } from "./files.js";

const currentUser = requireAuth();
if (currentUser && currentUser.role === "parent") location.replace("parent.html");
let state = null;

initPage();
initTabs();
mountArt(document.getElementById("art"), "melencolia");
rotateQuotes(document.getElementById("quote"), QUOTES.student);
document.getElementById("logoutBtn").onclick = logout;
if (currentUser) {
    document.getElementById("greeting").textContent = `Привет, ${currentUser.name.split(" ")[0] || currentUser.name}!`;
    if (currentUser.role === "admin") document.getElementById("adminLink").hidden = false;
}

const isMine = h => currentUser.role === "admin" || h.student === currentUser.username;
// Свои загрузки ученик может удалить; у решений — подпись, чтобы отличать от условия задания.
const filesHtml = (kind, id) => attachmentsHtml(filesFor(state.files, kind, id), {
    canDelete:f => f.owner === currentUser.username,
    note:f => kind === "homework" && f.owner === currentUser.username ? "твоё решение" : ""
});
const nameOf = u => (state.users.find(x => x.username === u) || {}).name || u;

async function loadData() {
    const status = document.getElementById("loadStatus");
    setStatus(status, "Обновляем данные…");
    try {
        state = await apiGet();
        renderMaterials();
        renderHomework();
        renderLessonNotes();
        renderProgress();
        renderAchievements();
        renderDeadlines();
        renderMessages();
        const events = state.schedule.filter(ev => !ev.student || ev.student === currentUser.username);
        events.push(...state.homework.filter(h => h.student === currentUser.username && h.due)
            .map(h => ({ date:String(h.due).slice(0, 10), time:"", type:"deadline", title:"Дедлайн: " + h.title, description:"" })));
        renderCalendar(document.getElementById("calendar"), events);
        updateStats();
        setStatus(status, "Данные обновлены", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}

function updateStats() {
    const mine = state.homework.filter(isMine);
    mountStats(document.getElementById("dashboardStats"), [
        [mine.length, "заданий в списке"],
        [mine.filter(h => h.status !== "done").length, "осталось сделать"],
        [average(state.grades), "средний балл из 5"],
        [state.achievements.length, "достижений"]
    ], countUp);
}

function renderProgress() {
    document.getElementById("progressChart").innerHTML = gradeBars(state.grades);
}

function renderAchievements() {
    document.getElementById("achievementsList").innerHTML = medallions(state.achievements.filter(a => a.student === currentUser.username));
}

function renderDeadlines() {
    const box = document.getElementById("deadlinesList");
    const upcoming = state.homework
        .filter(h => h.student === currentUser.username && h.status !== "done" && String(h.due).slice(0, 10) >= today())
        .sort((a, b) => String(a.due).localeCompare(String(b.due)))
        .slice(0, 5);
    if (!upcoming.length) { box.innerHTML = '<p class="muted small">Активных дедлайнов нет.</p>'; return; }
    box.innerHTML = upcoming.map(h => {
        const days = daysUntil(h.due);
        const badge = days <= 1 ? "danger" : days <= 3 ? "pending" : "plain";
        const label = days === 0 ? "сегодня" : days === 1 ? "завтра" : `через ${days} дн.`;
        return `<div class="item compact"><div class="row"><span>${esc(h.title)}</span><span class="badge ${badge}">${label}</span></div></div>`;
    }).join("");
}

async function renderMessages() {
    const box = document.getElementById("messagesList");
    const mine = state.messages.filter(m => m.to === currentUser.username || m.from === currentUser.username).sort(byDate).slice(-5);
    const unread = mine.filter(m => m.to === currentUser.username && !m.isRead).length;
    const badge = document.getElementById("unreadBadge");
    badge.textContent = unread;
    badge.hidden = unread === 0;
    if (!mine.length) { box.innerHTML = '<p class="muted small">Сообщений пока нет.</p>'; return; }
    box.innerHTML = mine.slice().reverse().map(m => messageHtml(m, currentUser.username, nameOf, filesHtml("message", m.id))).join("");
    if (unread > 0) {
        try { await apiPost({ action:"markMessagesRead" }); } catch (_) {}
    }
}

function renderLessonNotes() {
    const notes = state.lessonNotes.slice().sort(byDate).reverse();
    document.getElementById("lessonNotes").innerHTML = notes.length
        ? notes.map(n => noteHtml(n)).join("")
        : '<p class="muted">После первого занятия здесь появится заметка: что прошли и что повторить.</p>';
}

function renderMaterials() {
    const list = state.materials.filter(m => currentUser.role === "admin" || !m.grade || String(m.grade) === String(currentUser.grade));
    document.getElementById("materials").innerHTML = list.length ? list.map(m => `<article class="item">
        <div class="row"><h3>${esc(m.title)}</h3><span class="badge plain">${m.grade ? esc(m.grade) + " класс" : "для всех"}</span></div>
        ${m.topic ? `<p class="muted small">${esc(m.topic)}</p>` : ""}
        ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
        ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть материал</a>` : ""}
        ${filesHtml("material", m.id)}
    </article>`).join("") : '<p class="muted">Материалов пока нет.</p>';
}

function renderHomework() {
    const list = state.homework.filter(isMine);
    const now = today();
    const box = document.getElementById("homework");
    box.innerHTML = list.length ? list.slice().sort((a, b) => String(a.due).localeCompare(String(b.due))).map(h => {
        const done = h.status === "done", overdue = !done && String(h.due).slice(0, 10) < now;
        const badge = done ? '<span class="badge done">сделано</span>' : overdue ? '<span class="badge overdue">просрочено</span>' : '<span class="badge pending">в работе</span>';
        return `<article class="item">
            <div class="row"><h3>${esc(h.title)}</h3>${badge}</div>
            ${h.comment ? `<p class="muted small">${esc(h.comment)}</p>` : ""}
            <p class="muted small">Выдано ${esc(fmtDate(h.assigned))}, сдать до ${esc(fmtDate(h.due))}</p>
            ${h.link ? `<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">Открыть материал</a>` : ""}
            ${filesHtml("homework", h.id)}
            ${currentUser.role !== "admin"
                ? `<div class="hw-actions"><button class="${done ? "" : "primary"}" data-homework="${esc(h.id)}" data-status="${done ? "pending" : "done"}">${done ? "Снять отметку" : "Отметить выполненным"}</button>${solutionButtonHtml(h.id)}</div>`
                : `<p class="muted small">Ученик: ${esc(h.student)}</p>`}
        </article>`;
    }).join("") : '<p class="muted">Домашних заданий пока нет.</p>';
    box.querySelectorAll("[data-homework]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.homework, item = state.homework.find(h => String(h.id) === String(id));
        if (!item) return;
        const old = item.status, next = btn.dataset.status;
        item.status = next; renderHomework(); updateStats(); renderDeadlines();
        try {
            await apiPost({ action:"updateHomeworkStatus", homeworkId:id, status:next });
            if (next === "done") showToast("Отмечено как выполненное");
        } catch (e) {
            item.status = old; renderHomework(); updateStats(); renderDeadlines();
            showToast("Не удалось сохранить: " + e.message, true);
        }
    });
}

["materials", "homework", "messagesList"].forEach(id => bindAttachments(document.getElementById(id), () => state.files, loadData));
if (currentUser) bindSolutionUploads(document.getElementById("homework"), currentUser.username, loadData);

if (currentUser && currentUser.role !== "parent") loadData();
