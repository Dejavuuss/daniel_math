import { requireAuth, apiGet, apiPost, logout, today } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { QUOTES } from "./art.js";
import { mountHall, mountGallery } from "./gallery.js";
import { esc, byDate, fmtDate, daysUntil, average, showToast, setStatus, initTabs, mountStats, gradeBars, medallions, noteHtml, messageHtml, fold, groupBy, monthOf, classLabel } from "./ui.js";
import { renderCalendar } from "./calendar.js";
import { attachmentsHtml, bindAttachments, bindSolutionUploads, solutionButtonHtml, filesFor } from "./files.js";
import { autoTypeset } from "./math.js";
import { mountTests, mountBank, gradeRecords } from "./practice.js";
import { mountPasswordButton } from "./account.js";

const currentUser = requireAuth();
if (currentUser && currentUser.role === "parent") location.replace("parent.html");
const isStudent = currentUser && currentUser.role === "student";
let state = null, testsUi = null;

initPage();
initTabs();
mountHall(document.getElementById("art"), "melencolia");
mountGallery(document.getElementById("gallery"), "student");
rotateQuotes(document.getElementById("quote"), QUOTES.student);
document.getElementById("logoutBtn").onclick = logout;
mountPasswordButton();
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
// Класс берём из свежих данных: его мог поменять репетитор.
const myGrade = () => isStudent ? ((state.users.find(u => u.username === currentUser.username) || currentUser).grade ?? "") : "";
const myGrades = () => gradeRecords(state, isStudent ? currentUser.username : "");
const openTab = id => document.querySelector(`.tab[data-tab="${id}"]`)?.click();

async function loadData() {
    const status = document.getElementById("loadStatus");
    setStatus(status, "Обновляем данные…");
    try {
        state = await apiGet();
        const grade = myGrade();
        document.getElementById("classHint").textContent = grade ? `${grade} класс` : isStudent ? "класс не указан" : "все классы";
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
        testsUi = mountTests(document.getElementById("tests"), {
            tests:state.tests, results:state.testResults, keys:state.testKeys, grade,
            canTake:isStudent, onSubmitted:testSubmitted
        });
        mountBank(document.getElementById("bank"), state.problems, "tutor_bank_solved_" + currentUser.username, {
            grade, canGrade:isStudent,
            noGradeNote:isStudent && !grade ? "Репетитор ещё не указал твой класс, поэтому показаны задачи всех классов." : "",
            onSaved:item => { state.practiceResults.push(item); renderProgress(); updateStats(); }
        });
        updateStats();
        setStatus(status, "Данные обновлены", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}

// Тест сдан: результат — в успеваемость, а задание, к которому он прикреплён, отмечаем выполненным.
async function testSubmitted(testId, answers, key) {
    state.testResults.push({ id:`${testId}_${currentUser.username}`, testId, student:currentUser.username, answers, date:today() });
    if (key) state.testKeys[testId] = key;
    const linked = state.homework.filter(h => h.testId === testId && h.student === currentUser.username && h.status !== "done");
    for (const h of linked) {
        try { await apiPost({ action:"updateHomeworkStatus", homeworkId:h.id, status:"done" }); h.status = "done"; } catch (_) {}
    }
    renderHomework(); renderDeadlines(); renderProgress(); updateStats();
}

function updateStats() {
    const mine = state.homework.filter(isMine);
    mountStats(document.getElementById("dashboardStats"), [
        [mine.length, "заданий в списке"],
        [mine.filter(h => h.status !== "done").length, "осталось сделать"],
        [average(myGrades()), "средний балл из 5"],
        [state.achievements.length, "достижений"]
    ], countUp);
}

function renderProgress() {
    document.getElementById("progressChart").innerHTML = gradeBars(myGrades());
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
    const box = document.getElementById("lessonNotes");
    if (!notes.length) { box.innerHTML = '<p class="muted">После первого занятия здесь появится заметка: что прошли и что повторить.</p>'; return; }
    box.innerHTML = groupBy(notes, n => monthOf(n.date)).map(([month, list], i) =>
        fold("notes-" + month, esc(month), list.map(n => noteHtml(n)).join(""), { open:i === 0, count:list.length })).join("");
}

// Материалы по классам: свой класс и общие открыты, у репетитора — все классы свёрнутыми группами.
function renderMaterials() {
    const grade = myGrade();
    const list = state.materials.filter(m => !isStudent || !grade || !m.grade || String(m.grade) === String(grade));
    const box = document.getElementById("materials");
    if (!list.length) { box.innerHTML = '<p class="muted">Материалов пока нет.</p>'; return; }
    const order = [...Array.from({ length:11 }, (_, i) => String(i + 1)), ""];
    box.innerHTML = groupBy(list, m => m.grade ? String(m.grade) : "", order).map(([g, items]) =>
        fold("materials-" + (g || "all"), esc(classLabel(g)), items.map(m => `<article class="item">
            <div class="row"><h3>${esc(m.title)}</h3>${m.topic ? `<span class="badge plain">${esc(m.topic)}</span>` : ""}</div>
            ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
            ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть материал</a>` : ""}
            ${filesHtml("material", m.id)}
        </article>`).join(""), { open:isStudent && (g === String(grade) || g === ""), count:items.length })).join("");
}

function homeworkCard(h, now) {
    const done = h.status === "done", overdue = !done && String(h.due).slice(0, 10) < now;
    const badge = done ? '<span class="badge done">сделано</span>' : overdue ? '<span class="badge overdue">просрочено</span>' : '<span class="badge pending">в работе</span>';
    const test = h.testId && state.tests.find(t => t.id === h.testId);
    const passed = test && state.testResults.some(r => r.testId === test.id && r.student === h.student);
    return `<article class="item">
        <div class="row"><h3>${esc(h.title)}</h3>${badge}</div>
        ${h.comment ? `<p class="muted small">${esc(h.comment)}</p>` : ""}
        <p class="muted small">Выдано ${esc(fmtDate(h.assigned))}, сдать до ${esc(fmtDate(h.due))}</p>
        ${h.link ? `<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">Открыть материал</a>` : ""}
        ${test ? `<div class="hw-test"><span>Тест: <b>${esc(test.title)}</b>${passed ? " — сдан" : ""}</span>
            ${isStudent || passed ? `<button type="button" class="${passed ? "" : "primary"}" data-open-test="${esc(test.id)}">${passed ? "Разбор ответов" : "Пройти тест"}</button>` : ""}</div>`
            : h.testId ? '<p class="muted small">Прикреплённый тест удалён.</p>' : ""}
        ${filesHtml("homework", h.id)}
        ${currentUser.role !== "admin"
            ? `<div class="hw-actions"><button class="${done ? "" : "primary"}" data-homework="${esc(h.id)}" data-status="${done ? "pending" : "done"}">${done ? "Снять отметку" : "Отметить выполненным"}</button>${solutionButtonHtml(h.id)}</div>`
            : `<p class="muted small">Ученик: ${esc(nameOf(h.student))}</p>`}
    </article>`;
}

function renderHomework() {
    const list = state.homework.filter(isMine).sort((a, b) => String(a.due).localeCompare(String(b.due)));
    const now = today();
    const box = document.getElementById("homework");
    if (!list.length) { box.innerHTML = '<p class="muted">Домашних заданий пока нет.</p>'; return; }
    const groups = [
        ["hw-overdue", "Просрочено", list.filter(h => h.status !== "done" && String(h.due).slice(0, 10) < now), true],
        ["hw-active", "В работе", list.filter(h => h.status !== "done" && String(h.due).slice(0, 10) >= now), true],
        ["hw-done", "Выполнено", list.filter(h => h.status === "done").reverse(), false]
    ];
    box.innerHTML = groups.filter(([, , items]) => items.length)
        .map(([key, title, items, open]) => fold(key, title, items.map(h => homeworkCard(h, now)).join(""), { open, count:items.length })).join("");
}

document.getElementById("homework").addEventListener("click", async e => {
    const testBtn = e.target.closest("[data-open-test]");
    if (testBtn && testsUi) { openTab("t-tests"); testsUi.open(testBtn.dataset.openTest); return; }
    const btn = e.target.closest("[data-homework]");
    if (!btn) return;
    const id = btn.dataset.homework, item = state.homework.find(h => String(h.id) === String(id));
    if (!item) return;
    const old = item.status, next = btn.dataset.status;
    item.status = next; renderHomework(); updateStats(); renderDeadlines();
    try {
        await apiPost({ action:"updateHomeworkStatus", homeworkId:id, status:next });
        if (next === "done") showToast("Отмечено как выполненное");
    } catch (err) {
        item.status = old; renderHomework(); updateStats(); renderDeadlines();
        showToast("Не удалось сохранить: " + err.message, true);
    }
});

autoTypeset(document.querySelector("main"));
["materials", "homework", "messagesList"].forEach(id => bindAttachments(document.getElementById(id), () => state.files, loadData));
if (currentUser) bindSolutionUploads(document.getElementById("homework"), currentUser.username, loadData);

if (currentUser && currentUser.role !== "parent") loadData();
