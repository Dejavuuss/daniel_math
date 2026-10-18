import { requireAuth, apiGet, logout } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { mountArt, QUOTES } from "./art.js";
import { esc, byDate, fmtDate, average, setStatus, initTabs, mountStats, gradeBars, medallions, noteHtml, messageHtml, stars } from "./ui.js";
import { TYPE_INFO } from "./calendar.js";
import { attachmentsHtml, bindAttachments, bindSolutionUploads, solutionButtonHtml, filesFor } from "./files.js";

let files = [];

const parentUser = requireAuth("parent");

initPage();
initTabs();
mountArt(document.getElementById("art"), "wave");
rotateQuotes(document.getElementById("quote"), QUOTES.parent);
document.getElementById("logoutBtn").onclick = logout;
if (parentUser) document.getElementById("parentGreeting").textContent = "Здравствуйте, " + parentUser.name.split(" ")[0] + "!";

async function loadParentData() {
    const status = document.getElementById("parentStatus");
    try {
        const data = await apiGet();
        files = data.files;
        const child = data.users.find(u => u.role === "student");
        const filesHtml = (kind, id) => attachmentsHtml(filesFor(files, kind, id), {
            canDelete:f => f.owner === parentUser.username,
            note:f => kind !== "homework" ? "" : f.owner === parentUser.username ? "загружено вами"
                : child && f.owner === child.username ? "решение ученика" : ""
        });
        if (child) bindSolutionUploads(document.getElementById("parentHomework"), child.username, loadParentData);
        const childName = child ? child.name : "ученик";
        const nameOf = u => (data.users.find(x => x.username === u) || {}).name || u;
        const hw = data.homework, grades = data.grades, events = data.schedule, notes = data.lessonNotes.slice().sort(byDate).reverse();
        if (child) document.getElementById("childLine").textContent = `${child.name}: занятия и успехи.`;

        mountStats(document.getElementById("parentStats"), [
            [hw.length, "заданий выдано"],
            [hw.filter(h => h.status !== "done").length, "ещё не выполнено"],
            [average(grades), "средний балл из 5"],
            [notes.length, "занятий проведено"]
        ], countUp);

        document.getElementById("parentProgressChart").innerHTML = gradeBars(grades);
        document.getElementById("parentAchievements").innerHTML = medallions(data.achievements);

        document.getElementById("parentRecentNotes").innerHTML = notes.length
            ? notes.slice(0, 3).map(n => `<div class="item compact"><strong>${esc(n.topic)}</strong><div class="muted small">${esc(fmtDate(n.date))} <span class="lesson-note-rating">${stars(n.rating)}</span></div></div>`).join("")
            : '<p class="muted small">Занятий пока не было.</p>';

        const msgs = data.messages.slice().sort(byDate).slice(-3).reverse();
        document.getElementById("parentMessages").innerHTML = msgs.length
            ? msgs.map(m => messageHtml(m, parentUser.username, nameOf, filesHtml("message", m.id))).join("")
            : '<p class="muted small">Сообщений пока нет.</p>';

        document.getElementById("parentHomework").innerHTML = hw.length ? hw.slice().sort((a, b) => String(a.due).localeCompare(String(b.due))).map(h => `<article class="item">
            <div class="row"><h3>${esc(h.title)}</h3><span class="badge ${h.status === "done" ? "done" : "pending"}">${h.status === "done" ? "выполнено" : "не выполнено"}</span></div>
            <p class="muted small">Выдано ${esc(fmtDate(h.assigned))}, срок ${esc(fmtDate(h.due))}</p>
            ${h.link ? `<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">Открыть материал</a>` : ""}
            ${filesHtml("homework", h.id)}
            ${child ? `<div class="hw-actions">${solutionButtonHtml(h.id)}</div>` : ""}
        </article>`).join("") : `<p class="muted">${esc(childName)}: домашних заданий пока нет.</p>`;

        document.getElementById("parentGrades").innerHTML = grades.length ? `<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Предмет</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody>${grades.slice().sort(byDate).reverse().map(g => `<tr><td>${esc(fmtDate(g.date))}</td><td>${esc(g.subject)}</td><td><strong>${esc(g.grade)}</strong></td><td>${esc(g.comment)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Оценок пока нет.</p>';

        document.getElementById("parentNotes").innerHTML = notes.length ? notes.map(n => noteHtml(n)).join("") : '<p class="muted">Заметок пока нет.</p>';

        document.getElementById("parentSchedule").innerHTML = events.length ? events.slice().sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time))).map(ev => `<article class="item">
            <div class="row"><h3>${esc(ev.title)}</h3><span class="badge plain"><i class="dot ${esc(ev.type)}"></i>${esc(TYPE_INFO[ev.type] || ev.type)}</span></div>
            <p class="muted small">${esc(fmtDate(ev.date))}${ev.time ? ", " + esc(ev.time) : ""}</p>
            ${ev.description ? `<p>${esc(ev.description)}</p>` : ""}
        </article>`).join("") : '<p class="muted">Событий пока нет.</p>';

        document.getElementById("parentMaterials").innerHTML = data.materials.length ? data.materials.map(m => `<article class="item">
            <h3>${esc(m.title)}</h3>
            ${m.topic ? `<p class="muted small">${esc(m.topic)}</p>` : ""}
            ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
            ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть материал</a>` : ""}
            ${filesHtml("material", m.id)}
        </article>`).join("") : '<p class="muted">Материалов пока нет.</p>';

        setStatus(status, "Данные обновлены", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}
["parentHomework", "parentMaterials", "parentMessages"].forEach(id => bindAttachments(document.getElementById(id), () => files, loadParentData));
if (parentUser) loadParentData();
