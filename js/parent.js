import { requireAuth, apiGet, logout, today } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { QUOTES } from "./art.js";
import { mountHall, mountGallery } from "./gallery.js";
import { esc, byDate, fmtDate, average, setStatus, initTabs, mountStats, gradeBars, medallions, noteHtml, messageHtml, stars, fold, groupBy, monthOf, classLabel, genitive, daysUntil } from "./ui.js";
import { TYPE_INFO, renderCalendar } from "./calendar.js";
import { attachmentsHtml, bindAttachments, bindSolutionUploads, solutionButtonHtml, filesFor } from "./files.js";
import { autoTypeset } from "./math.js";
import { mountTests, gradeRecords } from "./practice.js";
import { scoreOf, gradeFor } from "./quiz.js";
import { mountPasswordButton } from "./account.js";

let files = [], testsUi = null;

const parentUser = requireAuth("parent");

initPage();
initTabs();
mountHall(document.getElementById("art"), "wave");
mountGallery(document.getElementById("gallery"), "parent");
rotateQuotes(document.getElementById("quote"), QUOTES.parent);
document.getElementById("logoutBtn").onclick = logout;
mountPasswordButton();
const parentName = u => String(u.name || "").split(",")[0].trim() || u.name;
if (parentUser) document.getElementById("parentGreeting").textContent = `Здравствуйте, ${parentName(parentUser)}!`;

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
        const me = data.users.find(u => u.username === parentUser.username);
        if (me) document.getElementById("parentGreeting").textContent = `Здравствуйте, ${parentName(me)}!`;
        document.getElementById("childLine").textContent = child
            ? `На сайте представлена успеваемость ${child.nameGen || genitive(child.name)}` : "Репетитор ещё не привязал к вам ученика.";

        const doneHw = hw.filter(h => h.status === "done");
        mountStats(document.getElementById("parentStats"), [
            [doneHw.length, `заданий выполнено из ${hw.length}`],
            [data.testResults.length, "тестов пройдено"],
            [average(grades), "средний балл из 5"],
            [notes.length, "занятий проведено"]
        ], countUp);

        document.getElementById("parentProgressChart").innerHTML = gradeBars(grades);
        document.getElementById("parentAchievements").innerHTML = medallions(data.achievements);

        document.getElementById("parentRecentNotes").innerHTML = notes.length
            ? notes.slice(0, 3).map(n => `<div class="item compact"><strong>${esc(n.topic)}</strong><div class="muted small">${esc(fmtDate(n.date))} <span class="lesson-note-rating">${stars(n.rating)}</span></div></div>`).join("")
            : '<p class="muted small">Занятий пока не было.</p>';

        renderDone(data, grades);
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
        const calEvents = events.slice();
        calEvents.push(...hw.filter(h => h.due).map(h => ({ date:String(h.due).slice(0, 10), time:"", type:"deadline", title:"Срок ДЗ: " + h.title, description:"" })));
        renderCalendar(document.getElementById("parentCalendar"), calEvents);
        const soon = evSorted.filter(ev => String(ev.date).slice(0, 10) >= now).slice(0, 4);
        document.getElementById("parentUpcoming").innerHTML = soon.length ? soon.map(ev => {
            const d = daysUntil(ev.date), when = d === 0 ? "сегодня" : d === 1 ? "завтра" : fmtDate(ev.date);
            return `<div class="item compact"><div class="row"><span>${esc(ev.title)}</span><span class="badge ${d <= 1 ? "pending" : "plain"}">${esc(when)}${ev.time ? ", " + esc(ev.time) : ""}</span></div></div>`;
        }).join("") : '<p class="muted small">Ближайших занятий в расписании нет.</p>';
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

        testsUi = mountTests(document.getElementById("parentTests"), {
            tests:data.tests, results:data.testResults, keys:data.testKeys, grade:child ? child.grade : "", canTake:false, onSubmitted:() => {}
        });

        setStatus(status, "Данные обновлены", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}
// «Пройдено»: сданные тесты с баллом, выполненные задания и тренировки на оценку.
function renderDone(data, grades) {
    const box = document.getElementById("parentDone");
    const tests = new Map(data.tests.map(t => [t.id, t]));
    const results = data.testResults.slice().sort(byDate).reverse();
    const hwDone = data.homework.filter(h => h.status === "done").sort((a, b) => String(b.due).localeCompare(String(a.due)));
    const practice = (data.practiceResults || []).slice().sort(byDate).reverse();
    const testRow = r => {
        const t = tests.get(r.testId), key = data.testKeys[r.testId];
        const s = t && key ? scoreOf(t, key, r.answers) : null;
        return `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(t ? t.title : "Тест удалён")}</td>
            <td>${s ? `${s.correct} из ${s.total}` : "—"}</td><td><strong>${s ? gradeFor(s.correct, s.total) : "—"}</strong></td>
            <td>${s ? `<button type="button" data-review-test="${esc(r.testId)}">Разбор</button>` : ""}</td></tr>`;
    };
    const table = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
    box.innerHTML = `<p class="done-summary"><span>Тестов сдано: <b>${results.length}</b></span><span>Заданий выполнено: <b>${hwDone.length} из ${data.homework.length}</b></span><span>Тренировок на оценку: <b>${practice.length}</b></span><span>Средний балл: <b>${average(grades)}</b></span></p>`
        + fold("p-done-tests", "Пройденные тесты", results.length ? table(["Дата", "Тест", "Результат", "Оценка", ""], results.map(testRow).join("")) : '<p class="empty-note">Тестов пока не сдавал.</p>', { open:true, count:results.length })
        + fold("p-done-hw", "Выполненные задания", hwDone.length ? table(["Задание", "Срок", "Тест"], hwDone.map(h => `<tr><td>${esc(h.title)}</td><td>${esc(fmtDate(h.due))}</td><td>${esc((tests.get(h.testId) || {}).title || "")}</td></tr>`).join("")) : '<p class="empty-note">Выполненных заданий пока нет.</p>', { open:true, count:hwDone.length })
        + fold("p-done-practice", "Тренировки на оценку", practice.length ? table(["Дата", "Тема", "Результат", "Оценка"], practice.map(r => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.topic)}</td><td>${r.correct} из ${r.total}</td><td><strong>${esc(r.grade)}</strong></td></tr>`).join("")) : '<p class="empty-note">Тренировок на оценку пока не было.</p>', { count:practice.length });

    const recent = [
        ...results.map(r => ({ date:r.date, text:"Тест: " + ((tests.get(r.testId) || {}).title || "") })),
        ...practice.map(r => ({ date:r.date, text:`Тренировка «${r.topic}», оценка ${r.grade}` }))
    ].sort(byDate).reverse().slice(0, 4);
    document.getElementById("parentRecentDone").innerHTML = recent.length
        ? recent.map(x => `<div class="item compact"><div class="row"><span>${esc(x.text)}</span><span class="muted small">${esc(fmtDate(x.date))}</span></div></div>`).join("")
        : '<p class="muted small">Пока ничего не пройдено.</p>';
}
document.getElementById("parentDone").addEventListener("click", e => {
    const b = e.target.closest("[data-review-test]");
    if (!b || !testsUi) return;
    document.querySelector('.tab[data-tab="p-tests"]').click();
    testsUi.open(b.dataset.reviewTest);
});

autoTypeset(document.querySelector("main"));
["parentHomework", "parentMaterials", "parentMessages"].forEach(id => bindAttachments(document.getElementById(id), () => files, loadParentData));
if (parentUser) loadParentData();
