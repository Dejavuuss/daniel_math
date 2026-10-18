import { requireAuth, apiGet, logout, today } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { mountArt, QUOTES } from "./art.js";
import { esc, byDate, fmtDate, average, setStatus, initTabs, mountStats, gradeBars, medallions, noteHtml, messageHtml, stars, fold, groupBy, monthOf, classLabel } from "./ui.js";
import { TYPE_INFO } from "./calendar.js";
import { attachmentsHtml, bindAttachments, bindSolutionUploads, solutionButtonHtml, filesFor } from "./files.js";
import { autoTypeset } from "./math.js";
import { mountTests, gradeRecords } from "./practice.js";

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
        const hw = data.homework, grades = gradeRecords(data, ""), events = data.schedule, notes = data.lessonNotes.slice().sort(byDate).reverse();
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

        const now = today();
        const hwCard = h => {
            const done = h.status === "done", overdue = !done && String(h.due).slice(0, 10) < now;
            const test = h.testId && data.tests.find(t => t.id === h.testId);
            return `<article class="item">
            <div class="row"><h3>${esc(h.title)}</h3><span class="badge ${done ? "done" : overdue ? "overdue" : "pending"}">${done ? "выполнено" : overdue ? "просрочено" : "не выполнено"}</span></div>
            <p class="muted small">Выдано ${esc(fmtDate(h.assigned))}, срок ${esc(fmtDate(h.due))}</p>
            ${h.comment ? `<p class="muted small">${esc(h.comment)}</p>` : ""}
            ${h.link ? `<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">Открыть материал</a>` : ""}
            ${test ? `<div class="hw-test"><span>Тест: <b>${esc(test.title)}</b>${data.testResults.some(r => r.testId === test.id) ? " — сдан" : " — не сдан"}</span></div>` : ""}
            ${filesHtml("homework", h.id)}
            ${child ? `<div class="hw-actions">${solutionButtonHtml(h.id)}</div>` : ""}
        </article>`;
        };
        const hwSorted = hw.slice().sort((a, b) => String(a.due).localeCompare(String(b.due)));
        const hwGroups = [
            ["p-hw-todo", "Не выполнено", hwSorted.filter(h => h.status !== "done"), true],
            ["p-hw-done", "Выполнено", hwSorted.filter(h => h.status === "done").reverse(), false]
        ].filter(([, , items]) => items.length);
        document.getElementById("parentHomework").innerHTML = hwGroups.length
            ? hwGroups.map(([key, title, items, open]) => fold(key, title, items.map(hwCard).join(""), { open, count:items.length })).join("")
            : `<p class="muted">${esc(childName)}: домашних заданий пока нет.</p>`;

        const gradeTable = list => `<div class="table-wrap"><table><thead><tr><th>Дата</th><th>За что</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody>${list.slice().sort(byDate).reverse().map(g => `<tr><td>${esc(fmtDate(g.date))}</td><td>${esc(g.subject)}</td><td><strong>${esc(g.grade)}</strong></td><td>${esc(g.comment)}</td></tr>`).join("")}</tbody></table></div>`;
        const kinds = [["lesson", "Оценки за занятия"], ["test", "Тесты"], ["practice", "Тренировки на оценку"]];
        document.getElementById("parentGrades").innerHTML = grades.length ? kinds.map(([kind, title], i) => {
            const list = grades.filter(g => g.kind === kind);
            return list.length ? fold("p-grades-" + kind, title, gradeTable(list), { open:i === 0, count:list.length, note:"средний " + average(list) }) : "";
        }).join("") : '<p class="muted">Оценок пока нет.</p>';

        document.getElementById("parentNotes").innerHTML = notes.length
            ? groupBy(notes, n => monthOf(n.date)).map(([month, list], i) => fold("p-notes-" + month, esc(month), list.map(n => noteHtml(n)).join(""), { open:i === 0, count:list.length })).join("")
            : '<p class="muted">Заметок пока нет.</p>';

        const evCard = ev => `<article class="item">
            <div class="row"><h3>${esc(ev.title)}</h3><span class="badge plain"><i class="dot ${esc(ev.type)}"></i>${esc(TYPE_INFO[ev.type] || ev.type)}</span></div>
            <p class="muted small">${esc(fmtDate(ev.date))}${ev.time ? ", " + esc(ev.time) : ""}</p>
            ${ev.description ? `<p>${esc(ev.description)}</p>` : ""}
        </article>`;
        const evSorted = events.slice().sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)));
        const upcoming = evSorted.filter(ev => String(ev.date).slice(0, 10) >= now), past = evSorted.filter(ev => String(ev.date).slice(0, 10) < now).reverse();
        document.getElementById("parentSchedule").innerHTML = events.length
            ? fold("p-ev-next", "Предстоящие", upcoming.length ? upcoming.map(evCard).join("") : '<p class="empty-note">Ближайших событий нет.</p>', { open:true, count:upcoming.length })
              + (past.length ? fold("p-ev-past", "Прошедшие", past.map(evCard).join(""), { count:past.length }) : "")
            : '<p class="muted">Событий пока нет.</p>';

        const childGrade = child && child.grade ? String(child.grade) : "";
        const materials = data.materials.filter(m => !childGrade || !m.grade || String(m.grade) === childGrade);
        const order = [...Array.from({ length:11 }, (_, i) => String(i + 1)), ""];
        document.getElementById("parentMaterials").innerHTML = materials.length
            ? groupBy(materials, m => m.grade ? String(m.grade) : "", order).map(([g, items]) => fold("p-materials-" + (g || "all"), esc(classLabel(g)), items.map(m => `<article class="item">
            <div class="row"><h3>${esc(m.title)}</h3>${m.topic ? `<span class="badge plain">${esc(m.topic)}</span>` : ""}</div>
            ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
            ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть материал</a>` : ""}
            ${filesHtml("material", m.id)}
        </article>`).join(""), { open:g === childGrade, count:items.length })).join("")
            : '<p class="muted">Материалов пока нет.</p>';

        mountTests(document.getElementById("parentTests"), {
            tests:data.tests, results:data.testResults, keys:data.testKeys, grade:child ? child.grade : "", canTake:false, onSubmitted:() => {}
        });

        setStatus(status, "Данные обновлены", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}
autoTypeset(document.querySelector("main"));
["parentHomework", "parentMaterials", "parentMessages"].forEach(id => bindAttachments(document.getElementById(id), () => files, loadParentData));
if (parentUser) loadParentData();
