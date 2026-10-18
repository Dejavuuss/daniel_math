import { requireAuth, apiGet, apiPost, logout, today, DEMO } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { QUOTES } from "./art.js";
import { mountHall, mountGallery, scientistOfDay } from "./gallery.js";
import { mountMessenger, trackUnread } from "./messages.js";
import { esc, byDate, fmtDate, average, showToast, setStatus, initTabs, noteHtml, messageHtml, fold, groupBy, monthOf, classLabel, genitive, openTab } from "./ui.js";
import { createPicker, attach, attachmentsHtml, bindAttachments, filesFor } from "./files.js";
import { autoTypeset, mathPreview } from "./math.js";
import { mountTestBuilder } from "./test-builder.js";
import { mountPasswordButton } from "./account.js";
import { reviewHtml, gradeRecords } from "./practice.js";
import { scoreOf, gradeFor } from "./quiz.js";

const adminUser = requireAuth("admin");
let state = null;

initPage();
initTabs();
mountHall(document.getElementById("art"), "athens");
mountGallery(document.getElementById("gallery"), "admin");
rotateQuotes(document.getElementById("quote"), QUOTES.admin);
document.getElementById("logoutBtn").onclick = logout;
mountPasswordButton();
document.getElementById("dailyScientist").innerHTML = scientistOfDay();
const messenger = mountMessenger(document.getElementById("messenger"), {
    me:adminUser && adminUser.username, isAdmin:true, getState:() => state, reload:() => loadData()
});
const updateUnread = trackUnread("t-messages", { me:adminUser && adminUser.username, getState:() => state, onRead:() => renderOverview() });
if (adminUser) document.getElementById("adminGreeting").textContent = greeting() + ", " + adminUser.name.split(" ")[0] + "!";
autoTypeset(document.querySelector("main"));
document.querySelectorAll("[data-preview-for]").forEach(out => mathPreview(document.getElementById(out.dataset.previewFor), out));
// Даты в формах по умолчанию — сегодня.
document.querySelectorAll('input[type="date"]').forEach(i => { i.value = today(); i.defaultValue = today(); });

function greeting() {
    const h = new Date().getHours();
    return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

async function loadData() {
    const status = document.getElementById("adminStatus");
    setStatus(status, "Загружаем данные…");
    try {
        state = await apiGet();
        fillStudents();
        renderLists();
        renderOverview();
        messenger.render();
        updateUnread();
        reapplySearch();
        countUp(document.getElementById("statStudents"), state.users.filter(u => u.role === "student").length);
        countUp(document.getElementById("statHomework"), state.homework.length);
        countUp(document.getElementById("statMaterials"), state.materials.length);
        countUp(document.getElementById("statLessons"), state.lessonNotes.length);
        setStatus(status, DEMO ? "Демо-данные загружены" : "Синхронизировано с Firebase", "ok");
    } catch (e) { setStatus(status, "Ошибка: " + e.message, "bad"); }
}

function fillStudents() {
    const opts = state.users.filter(u => u.role === "student").map(u => `<option value="${esc(u.username)}">${esc(u.name)} (${esc(u.username)})</option>`).join("");
    ["studentSelect","eventStudent","gradeStudent","parentChild","noteStudent","payStudent","achStudent","testStudent"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const keep = el.value;
        el.innerHTML = (id === "eventStudent" || id === "testStudent" ? '<option value="">Все ученики</option>' : "") + opts;
        if (keep) el.value = keep;
    });
    fillHomeworkTests();
    fillAlsoStudents();
}

const nameOf = u => ((state.directory || []).find(d => d.id === u) || state.users.find(x => x.username === u) || {}).name || u;
const KIND = { materials:"material", homework:"homework", messages:"message" };
// Файлы записи; у решений, загруженных учеником или родителем, — подпись «от …».
const filesCell = (kind, id) => attachmentsHtml(filesFor(state.files, kind, id), {
    canDelete:() => true,
    note:f => f.owner !== adminUser.username ? "от " + nameOf(f.owner) : ""
});

const students = () => state.users.filter(u => u.role === "student").sort((a, b) => a.name.localeCompare(b.name, "ru"));
const CLASS_ORDER = [...Array.from({ length:11 }, (_, i) => String(i + 1)), ""];
const recent = list => list.slice().sort(byDate).reverse();
const delBtn = (collection, id, confirmText) => `<button class="danger" data-delete-sheet="${collection}" data-delete-id="${esc(id)}"${confirmText ? ` data-confirm="${esc(confirmText)}"` : ""}>Удалить</button>`;
const empty = text => `<p class="muted">${text}</p>`;
const EDITABLE = ["materials", "homework", "schedule", "grades", "lessonNotes", "payments", "achievements", "problems"];
const editBtn = (collection, id) => EDITABLE.includes(collection) ? `<button type="button" class="ghost" data-edit-sheet="${collection}" data-edit-id="${esc(id)}">Изменить</button>` : "";
const rowActions = (collection, id) => `<div class="row-actions">${editBtn(collection, id)}${delBtn(collection, id)}</div>`;

function table(rows, fields, collection) {
    if (!rows.length) return '<p class="empty-note">Записей пока нет.</p>';
    const cell = (r, f) => f === "url" || f === "link"
        ? (r[f] ? `<a href="${esc(r[f])}" target="_blank" rel="noopener noreferrer">открыть</a>` : "")
        : f === "files" ? filesCell(KIND[collection], r.id)
        : f === "student" || f === "child" ? esc(nameOf(r[f]))
        : f === "date" || f === "assigned" || f === "due" ? esc(fmtDate(r[f]))
        : f === "testId" ? esc((state.tests.find(t => t.id === r.testId) || {}).title || "")
        : f === "status" ? ({ done:'<span class="badge done">сделано</span>', cancelled:'<span class="badge plain">отменено</span>', planned:'<span class="badge info">запланировано</span>' }[r.status] || '<span class="badge pending">в работе</span>')
        : esc(r[f]);
    return `<div class="table-wrap"><table><thead><tr>${fields.map(f => `<th>${f[1]}</th>`).join("")}${collection ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(r => `<tr>${fields.map(f => `<td>${cell(r, f[0])}</td>`).join("")}${collection ? `<td class="cell-actions">${rowActions(collection, r.id)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

// Группы по ученику: [[username, записи]] в алфавитном порядке имён, затем остальные.
const byStudent = (list, key = "student") => groupBy(list, r => r[key] || "", students().map(u => u.username));
const studentTitle = u => u ? esc(nameOf(u)) : "Все ученики";

function renderLists() {
    renderClasses();

    document.getElementById("l-materials").innerHTML = state.materials.length
        ? groupBy(state.materials, m => m.grade ? String(m.grade) : "", CLASS_ORDER).map(([g, items]) =>
            fold("a-materials-" + (g || "all"), esc(classLabel(g)), table(items, [["title","Название"],["topic","Тема"],["url","Ссылка"],["files","Файлы"]], "materials"), { count:items.length })).join("")
        : empty("Материалов пока нет.");

    const now = today();
    document.getElementById("l-homework").innerHTML = state.homework.length
        ? byStudent(state.homework.slice().sort((a, b) => String(b.due).localeCompare(String(a.due)))).map(([u, items]) => {
            const todo = items.filter(h => h.status !== "done");
            const overdue = todo.filter(h => String(h.due).slice(0, 10) < now).length;
            return fold("a-hw-" + u, studentTitle(u), table(items, [["title","Задание"],["assigned","Выдано"],["due","Сдать до"],["status","Статус"],["testId","Тест"],["link","Ссылка"],["files","Файлы"]], "homework"),
                { count:items.length, note:todo.length ? `не сделано ${todo.length}${overdue ? `, просрочено ${overdue}` : ""}` : "всё сделано" });
        }).join("")
        : empty("Заданий пока нет.");

    const evFields = [["date","Дата"],["time","Время"],["type","Тип"],["title","Событие"],["student","Ученик"],["status","Статус"]];
    const upcoming = state.schedule.filter(e => String(e.date).slice(0, 10) >= now).sort(byDate), past = recent(state.schedule.filter(e => String(e.date).slice(0, 10) < now));
    document.getElementById("l-schedule").innerHTML = state.schedule.length
        ? fold("a-ev-next", "Предстоящие", table(upcoming, evFields, "schedule"), { open:true, count:upcoming.length })
          + fold("a-ev-past", "Прошедшие", table(past, evFields, "schedule"), { count:past.length })
        : empty("Событий пока нет.");

    renderGrades();

    document.getElementById("l-notes").innerHTML = state.lessonNotes.length
        ? byStudent(recent(state.lessonNotes)).map(([u, items]) => fold("a-notes-" + u, studentTitle(u),
            groupBy(items, n => monthOf(n.date)).map(([month, list]) => fold(`a-notes-${u}-${month}`, esc(month),
                list.map(n => noteHtml(n).replace("</article>", `${rowActions("lessonNotes", n.id)}</article>`)).join(""), { count:list.length })).join(""),
            { count:items.length, note:"последнее " + fmtDate(items[0].date) })).join("")
        : empty("Заметок пока нет.");

    document.getElementById("l-payments").innerHTML = state.payments.length
        ? byStudent(recent(state.payments)).map(([u, items]) => {
            const sum = type => items.filter(p => p.type === type).reduce((s, p) => s + Number(p.amount || 0), 0);
            return fold("a-pay-" + u, studentTitle(u), table(items, [["date","Дата"],["amount","Сумма"],["type","Тип"],["description","Описание"]], "payments"),
                { count:items.length, note:`оплачено ${sum("paid")} ₽, занятий на ${sum("lesson")} ₽` });
        }).join("")
        : empty("Платежей пока нет.");

    document.getElementById("l-achievements").innerHTML = state.achievements.length
        ? byStudent(recent(state.achievements)).map(([u, items]) => fold("a-ach-" + u, studentTitle(u), items.map(a => `<article class="item"><div class="row"><h3>${esc(a.icon || "🏆")} ${esc(a.title)}</h3><span class="muted small">${esc(fmtDate(a.date))}</span></div>${a.description ? `<p class="muted">${esc(a.description)}</p>` : ""}${rowActions("achievements", a.id)}</article>`).join(""), { count:items.length })).join("")
        : empty("Достижений пока нет.");

    renderAccounts();

    renderTests();
    renderProblems();

    document.querySelectorAll("[data-delete-sheet]").forEach(btn => btn.onclick = async () => {
        if (!confirm(btn.dataset.confirm || "Удалить эту запись?")) return;
        btn.disabled = true;
        try { await apiPost({ action:"deleteRow", sheet:btn.dataset.deleteSheet, id:btn.dataset.deleteId }); await loadData(); showToast("Запись удалена"); }
        catch (e) { btn.disabled = false; showToast("Не удалось удалить: " + e.message, true); }
    });
}

// Аккаунты: у каждого — форма правки и удаление. Логин и роль не меняются (логин — это вход в Firebase).
function renderAccounts() {
    const classOptions = g => '<option value="">не указан</option>' + Array.from({ length:11 }, (_, i) => i + 1)
        .map(n => `<option value="${n}"${String(g) === String(n) ? " selected" : ""}>${n} класс</option>`).join("");
    const parentsOf = u => state.users.filter(x => x.role === "parent" && x.child === u.username);
    const danger = u => `<div class="danger-zone">
        <label><input type="checkbox" data-with-records checked> и все записи${u.role === "student" ? " ученика" : ""}</label>
        <button type="button" class="danger" data-delete-account="${esc(u.username)}">Удалить аккаунт</button></div>`;
    const list = students();
    document.getElementById("l-students").innerHTML = list.length ? list.map(u => fold("a-acc-" + u.username, esc(u.name),
        `<form class="account-form" data-account="${esc(u.username)}" data-role="student" novalidate>
            <div class="grid2">
                <div><label>Имя и фамилия</label><input name="name" value="${esc(u.name)}" required maxlength="100"></div>
                <div><label>Класс</label><select name="grade">${classOptions(u.grade)}</select></div>
                <div><label>Имя в родительном падеже</label><input name="nameGen" value="${esc(u.nameGen || "")}" placeholder="${esc(genitive(u.name))}" maxlength="100"></div>
                <div><label>Логин</label><input value="${esc(u.username)}" disabled></div>
            </div>
            <p class="form-hint">Родитель видит: «На сайте представлена успеваемость ${esc(u.nameGen || genitive(u.name))}». ${parentsOf(u).length ? "Родитель: " + parentsOf(u).map(x => esc(x.name)).join(", ") + "." : "Родитель не привязан."}</p>
            <div class="account-actions"><button class="primary" type="submit">Сохранить</button>${danger(u)}</div>
        </form>`, { note:`${u.username}, ${u.grade ? u.grade + " класс" : "класс не указан"}` })).join("") : '<p class="empty-note">Учеников пока нет.</p>';

    const parents = state.users.filter(u => u.role === "parent").sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const childOptions = c => list.map(s => `<option value="${esc(s.username)}"${s.username === c ? " selected" : ""}>${esc(s.name)}</option>`).join("");
    document.getElementById("l-parents").innerHTML = parents.length ? parents.map(u => fold("a-acc-" + u.username, esc(u.name),
        `<form class="account-form" data-account="${esc(u.username)}" data-role="parent" novalidate>
            <div class="grid2">
                <div><label>Имя родителя</label><input name="name" value="${esc(u.name)}" required maxlength="100"></div>
                <div><label>Ребёнок</label><select name="child">${childOptions(u.child)}</select></div>
                <div><label>Логин</label><input value="${esc(u.username)}" disabled></div>
            </div>
            <p class="form-hint">Приветствие: «Здравствуйте, ${esc(String(u.name).split(",")[0].trim())}!» — имя берётся до запятой.</p>
            <div class="account-actions"><button class="primary" type="submit">Сохранить</button>${danger(u)}</div>
        </form>`, { note:`${u.username}, ребёнок: ${nameOf(u.child)}` })).join("") : '<p class="empty-note">Родителей пока нет.</p>';
}

for (const id of ["l-students", "l-parents"]) {
    const box = document.getElementById(id);
    box.addEventListener("submit", async e => {
        const form = e.target.closest(".account-form");
        if (!form) return;
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = "Сохраняем…";
        try {
            await apiPost(Object.assign({ action:"updateUser", username:form.dataset.account, role:form.dataset.role }, formData(form)));
            await loadData();
            showToast("Данные сохранены");
        } catch (err) { btn.disabled = false; btn.textContent = "Сохранить"; showToast("Не удалось сохранить: " + err.message, true); }
    });
    box.addEventListener("click", async e => {
        const btn = e.target.closest("[data-delete-account]");
        if (!btn) return;
        const name = btn.dataset.deleteAccount, u = state.users.find(x => x.username === name);
        const withRecords = btn.closest(".danger-zone").querySelector("[data-with-records]").checked;
        const parents = u.role === "student" ? state.users.filter(x => x.role === "parent" && x.child === name) : [];
        const text = [`Удалить аккаунт «${u.name}» (${name})? Войти под ним больше не получится.`,
            parents.length ? `Вместе с ним удалятся аккаунты родителей: ${parents.map(x => x.name).join(", ")}.` : "",
            withRecords ? (u.role === "student" ? "Удалятся также все его задания, оценки, заметки, платежи, достижения, сообщения и результаты тестов." : "Удалятся также его сообщения.") : "Записи останутся в журналах.",
            "Отменить это нельзя."].filter(Boolean).join("\n\n");
        if (!confirm(text)) return;
        btn.disabled = true; btn.textContent = "Удаляем…";
        try {
            await apiPost({ action:"deleteAccount", username:name, withRecords });
            await loadData();
            showToast("Аккаунт удалён");
        } catch (err) { btn.disabled = false; btn.textContent = "Удалить аккаунт"; showToast("Не удалось удалить: " + err.message, true); }
    });
}

// Классы: ученики по классам; класс меняется выпадающим списком и сохраняется сразу.
function renderClasses() {
    const box = document.getElementById("l-classes");
    const list = students();
    if (!list.length) { box.innerHTML = empty("Учеников пока нет — добавьте их во вкладке «Аккаунты»."); return; }
    const options = g => '<option value="">не указан</option>' + Array.from({ length:11 }, (_, i) => i + 1)
        .map(n => `<option value="${n}"${String(g) === String(n) ? " selected" : ""}>${n} класс</option>`).join("");
    box.innerHTML = groupBy(list, u => u.grade ? String(u.grade) : "", CLASS_ORDER).map(([g, items]) =>
        fold("a-class-" + (g || "none"), g ? `${esc(g)} класс` : "Класс не указан", items.map(u => {
            const parent = state.users.find(x => x.role === "parent" && x.child === u.username);
            return `<div class="class-row"><div class="who">${esc(u.name)}<small>${esc(u.username)}${parent ? ", родитель: " + esc(parent.name) : ""}</small></div>
                <select data-set-grade="${esc(u.username)}" aria-label="Класс ученика">${options(u.grade)}</select>
                <button type="button" class="ghost" data-edit-account="${esc(u.username)}">Изменить имя и данные</button></div>`;
        }).join(""), { open:true, count:items.length })).join("");
}

document.getElementById("l-classes").addEventListener("click", e => {
    const b = e.target.closest("[data-edit-account]");
    if (!b) return;
    openTab("t-accounts");
    const d = document.querySelector(`details[data-fold="a-acc-${CSS.escape(b.dataset.editAccount)}"]`);
    if (d) { d.open = true; d.scrollIntoView({ block:"start" }); d.querySelector("input[name=name]")?.focus(); }
});
document.getElementById("l-classes").addEventListener("change", async e => {
    const sel = e.target.closest("[data-set-grade]");
    if (!sel) return;
    sel.disabled = true;
    try {
        await apiPost({ action:"setGrade", username:sel.dataset.setGrade, grade:sel.value });
        await loadData();
        showToast(sel.value ? `Класс сохранён: ${sel.value}` : "Класс убран");
    } catch (err) { sel.disabled = false; showToast("Не удалось сохранить: " + err.message, true); }
});

// Успеваемость по ученикам: оценки за занятия, тесты и тренировки вместе.
function renderGrades() {
    const box = document.getElementById("l-grades");
    const all = gradeRecords(state, "");
    if (!all.length) { box.innerHTML = empty("Оценок пока нет."); return; }
    const KIND_LABEL = { lesson:"занятие", test:"тест", practice:"тренировка" };
    const DELETE = { lesson:["grades"], practice:["practiceResults"], test:["testResults", "Удалить результат теста? Ученик сможет пройти его заново."] };
    box.innerHTML = byStudent(recent(all)).map(([u, items]) => fold("a-grades-" + u, studentTitle(u),
        `<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Откуда</th><th>За что</th><th>Оценка</th><th>Комментарий</th><th></th></tr></thead><tbody>${items.map(g =>
            `<tr><td>${esc(fmtDate(g.date))}</td><td>${KIND_LABEL[g.kind]}</td><td>${esc(g.subject)}</td><td><strong>${esc(g.grade)}</strong></td><td>${esc(g.comment)}</td><td>${delBtn(DELETE[g.kind][0], g.id, DELETE[g.kind][1])}</td></tr>`).join("")}</tbody></table></div>`,
        { count:items.length, note:"средний " + average(items) })).join("");
}

// Тесты по классам; каждый тест — своя группа: кто сдал (балл из ответов и ключа) и кто ещё нет.
function renderTests() {
    const box = document.getElementById("l-tests");
    const tests = state.tests.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!tests.length) { box.innerHTML = empty("Тестов пока нет."); return; }
    const all = students();
    const groupOf = t => t.student ? "personal" : t.grade ? String(t.grade) : "";
    box.innerHTML = groupBy(tests, groupOf, [...CLASS_ORDER, "personal"]).map(([g, list]) => fold("a-tests-" + (g || "all"),
        g === "personal" ? "Личные тесты" : esc(classLabel(g)), list.map(t => {
        const key = state.testKeys[t.id] || [];
        const results = state.testResults.filter(r => r.testId === t.id);
        const audience = t.student ? [all.find(s => s.username === t.student)].filter(Boolean)
            : all.filter(s => !t.grade || String(s.grade) === String(t.grade));
        const missing = audience.filter(s => !results.some(r => r.student === s.username));
        const inner = `<p class="muted small">${[t.topic, t.questions.length + " вопр.", "создан " + fmtDate(t.date), t.student ? "для " + nameOf(t.student) : ""].filter(Boolean).map(esc).join(", ")}</p>
            ${results.length ? `<div class="table-wrap"><table><thead><tr><th>Ученик</th><th>Результат</th><th>Сдан</th><th></th></tr></thead><tbody>
                ${results.map(r => { const s = scoreOf(t, key, r.answers); return `<tr>
                    <td>${esc(nameOf(r.student))}</td><td><strong>${s.correct} из ${s.total}</strong>, «${gradeFor(s.correct, s.total)}»</td><td>${esc(fmtDate(r.date))}</td>
                    <td class="cell-actions"><button data-show-answers="${esc(r.id)}">Ответы</button>
                    <button class="danger" data-delete-sheet="testResults" data-delete-id="${esc(r.id)}" data-confirm="Удалить результат? Ученик сможет пройти тест заново.">Пересдать</button></td></tr>
                    <tr class="answers-row" id="answers-${esc(r.id)}" hidden><td colspan="4">${reviewHtml(t, key, r.answers)}</td></tr>`; }).join("")}
            </tbody></table></div>` : '<p class="empty-note">Ещё никто не сдал.</p>'}
            ${missing.length ? `<p class="muted small">Не сдали: ${missing.map(s => esc(s.name)).join(", ")}</p>` : ""}
            <button class="danger" data-delete-sheet="tests" data-delete-id="${esc(t.id)}" data-confirm="Удалить тест вместе с результатами?">Удалить тест</button>`;
        return fold("a-test-" + t.id, esc(t.title), inner, { note:`сдали ${results.length} из ${Math.max(audience.length, results.length)}` });
    }).join(""), { count:list.length })).join("");
    box.querySelectorAll("[data-show-answers]").forEach(b => b.onclick = () => {
        const row = document.getElementById("answers-" + b.dataset.showAnswers);
        row.hidden = !row.hidden;
        b.textContent = row.hidden ? "Ответы" : "Скрыть";
    });
}

// Банк: класс → тема → задачи.
function renderProblems() {
    const box = document.getElementById("l-problems");
    const topics = [...new Set(state.problems.map(p => p.topic))].sort((a, b) => a.localeCompare(b, "ru"));
    document.getElementById("topicList").innerHTML = topics.map(t => `<option value="${esc(t)}">`).join("");
    if (!state.problems.length) { box.innerHTML = empty("Задач пока нет."); return; }
    box.innerHTML = groupBy(state.problems, p => p.grade ? String(p.grade) : "", CLASS_ORDER).map(([g, list]) => {
        const byTopic = groupBy(list.slice().sort((a, b) => a.topic.localeCompare(b.topic, "ru") || a.difficulty - b.difficulty), p => p.topic);
        return fold("a-bank-" + (g || "all"), esc(classLabel(g)), byTopic.map(([topic, items]) => fold(`a-bank-${g}-${topic}`, esc(topic), items.map(p => `<article class="item compact problem-admin">
            <div class="row"><span class="difficulty" aria-label="Сложность ${p.difficulty} из 3">${"●".repeat(p.difficulty)}${"○".repeat(3 - p.difficulty)}</span></div>
            <div class="problem-text">${esc(p.text)}</div>
            <p class="muted small">Ответ: ${esc(p.answer)}</p>
            ${rowActions("problems", p.id)}
        </article>`).join(""), { count:items.length })).join(""), { count:list.length, note:`тем: ${byTopic.length}` });
    }).join("");
}

// Тесты, которые можно прикрепить к заданию выбранного ученика: его личные и для его класса (или для всех).
function fillHomeworkTests() {
    const sel = document.getElementById("h-test"), who = document.getElementById("studentSelect").value;
    const st = state.users.find(u => u.username === who), keep = sel.value;
    const fits = state.tests.filter(t => t.student ? t.student === who : !t.grade || !st || !st.grade || String(t.grade) === String(st.grade))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    sel.innerHTML = '<option value="">Без теста</option>' + fits.map(t => `<option value="${esc(t.id)}">${esc(t.title)}${t.grade ? `, ${esc(t.grade)} класс` : ""}${t.student ? ", личный" : ""}</option>`).join("");
    if (fits.some(t => t.id === keep)) sel.value = keep;
}
document.getElementById("studentSelect").addEventListener("change", fillHomeworkTests);

function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = v; }); return o; }

// files — {kind, extra(data)}: после сохранения записи прикрепить выбранные файлы.
// also(form) — ещё ученики: та же запись (с теми же файлами) создаётся и для них.
function submitForm(id, action, done, files, also) {
    const form = document.getElementById(id);
    const picker = files ? createPicker(form.querySelector("[data-attach]")) : null;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]'), oldText = button.textContent;
        button.disabled = true; button.textContent = "Сохраняем…";
        let saved = false;
        try {
            const data = formData(form);
            delete data.also;
            const targets = [data, ...(also ? also(form).map(student => Object.assign({}, data, { student })) : [])];
            for (const d of targets) {
                const res = await apiPost(Object.assign({ action }, d));
                saved = true;
                if (picker && picker.files().length) {
                    button.textContent = "Загружаем файлы…";
                    await attach(files.kind, res.item.id, picker.files(), files.extra ? files.extra(d) : {});
                }
            }
            if (targets.length > 1) done += ` (учеников: ${targets.length})`;
            form.reset();
            if (picker) picker.clear();
            await loadData();
            showToast(done);
        } catch (err) {
            showToast(saved ? "Запись сохранена, но файлы не загрузились: " + err.message : "Не удалось сохранить: " + err.message, true);
            if (saved) await loadData();
        }
        finally { button.disabled = false; button.textContent = oldText; }
    });
}

submitForm("f-materials", "addMaterial", "Материал сохранён", { kind:"material" });
submitForm("f-homework", "addHomework", "Задание выдано", { kind:"homework", extra:d => ({ student:d.student }) },
    form => [...form.querySelectorAll("[data-also] input:checked")].map(i => i.value));
submitForm("f-schedule", "addEvent", "Событие добавлено");
submitForm("f-grades", "addGrade", "Оценка сохранена");
submitForm("f-notes", "addLessonNote", "Заметка сохранена");
submitForm("f-payments", "addPayment", "Запись добавлена");
submitForm("f-achievements", "addAchievement", "Достижение выдано");
submitForm("f-students", "addStudent", "Аккаунт ученика создан");
submitForm("f-problems", "addProblem", "Задача добавлена");

// Тест собирается из конструктора вопросов, поэтому сохраняется отдельно.
const testForm = document.getElementById("f-tests");
const builder = mountTestBuilder(testForm);
testForm.addEventListener("submit", async e => {
    e.preventDefault();
    const button = testForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Сохраняем…";
    try {
        await apiPost(Object.assign({ action:"addTest" }, formData(testForm), { questions:builder.collect() }));
        testForm.reset(); builder.reset();
        await loadData();
        showToast("Тест сохранён");
    } catch (err) { showToast("Не удалось сохранить: " + err.message, true); }
    finally { button.disabled = false; button.textContent = "Сохранить тест"; }
});
submitForm("f-parents", "addParent", "Аккаунт родителя создан");

["l-materials", "l-homework"].forEach(id => bindAttachments(document.getElementById(id), () => state.files, loadData));


/* ---------- Обзор дня ---------- */

const shiftDay = (d, n) => { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
function renderOverview() {
    const now = today(), tomorrow = shiftDay(now, 1);
    const lessons = state.schedule.filter(e => e.date === now || e.date === tomorrow)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    document.getElementById("ovLessons").innerHTML = lessons.length ? lessons.map(e => `<div class="item compact"><time>${esc(e.time || "весь день")}</time>
        <div><b>${esc(e.title)}</b><div class="muted small">${e.date === now ? "сегодня" : "завтра"}, ${e.student ? esc(nameOf(e.student)) : "все ученики"}</div></div></div>`).join("")
        : '<p class="empty-note">На сегодня и завтра в календаре ничего нет.</p>';
    const overdue = state.homework.filter(h => h.status !== "done" && String(h.due).slice(0, 10) < now).sort((a, b) => String(a.due).localeCompare(String(b.due)));
    document.getElementById("ovOverdue").innerHTML = overdue.length ? overdue.slice(0, 6).map(h => `<div class="item compact"><div class="row">
        <span><b>${esc(nameOf(h.student))}</b>: ${esc(h.title)}</span><span class="badge overdue">до ${esc(fmtDate(h.due))}</span></div></div>`).join("")
        + (overdue.length > 6 ? `<p class="muted small">И ещё ${overdue.length - 6}.</p>` : "")
        : '<p class="empty-note">Просроченных заданий нет.</p>';
    const unread = state.messages.filter(m => m.to === adminUser.username && !m.isRead).sort(byDate).reverse();
    document.getElementById("ovMessages").innerHTML = unread.length ? unread.slice(0, 4).map(m => `<div class="item compact"><b>${esc(nameOf(m.from))}</b>
        <div class="muted small">${esc(String(m.text).slice(0, 120))}${String(m.text).length > 120 ? "…" : ""}</div></div>`).join("")
        : '<p class="empty-note">Новых сообщений нет.</p>';
    const balances = students().map(u => {
        const sum = type => state.payments.filter(p => p.student === u.username && p.type === type).reduce((s, p) => s + Number(p.amount || 0), 0);
        return { u, balance:sum("paid") - sum("refund") - sum("lesson") };
    }).filter(x => state.payments.some(p => p.student === x.u.username));
    document.getElementById("ovBalance").innerHTML = balances.length ? balances.map(({ u, balance }) => `<div class="item compact"><div class="row">
        <span>${esc(u.name)}</span><span class="${balance < 0 ? "balance-neg" : "balance-pos"}">${balance > 0 ? "+" : ""}${balance.toLocaleString("ru-RU")} ₽</span></div></div>`).join("")
        : '<p class="empty-note">Платежей пока нет.</p>';
}

document.getElementById("backupBtn").addEventListener("click", () => {
    if (!state) return;
    const data = Object.assign({ exportedAt:new Date().toISOString() }, state);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type:"application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `math-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast("Копия скачана");
});

/* ---------- Правка записей ---------- */

// Окно правки собирается из той же формы, что и добавление: поля и проверки одинаковые.
const EDIT_FORMS = { materials:"f-materials", homework:"f-homework", schedule:"f-schedule", grades:"f-grades", lessonNotes:"f-notes",
    payments:"f-payments", achievements:"f-achievements", problems:"f-problems" };
const STATUS_OPTIONS = {
    homework:[["pending", "В работе"], ["done", "Сделано"]],
    schedule:[["planned", "Запланировано"], ["done", "Проведено"], ["cancelled", "Отменено"]]
};
const editDlg = document.createElement("dialog");
editDlg.className = "dialog";
document.body.appendChild(editDlg);

function openEdit(sheet, id) {
    const rec = (state[sheet] || []).find(r => String(r.id) === String(id));
    const src = document.getElementById(EDIT_FORMS[sheet]);
    if (!rec || !src) return;
    const form = src.cloneNode(true);
    form.removeAttribute("id");
    form.className = "dialog-form";
    form.noValidate = true;
    form.querySelectorAll("[data-attach], .math-preview, [data-also-wrap], .math-hint").forEach(el => el.remove());
    form.querySelectorAll("[id]").forEach(el => { el.id = "edit-" + el.id; });
    form.querySelectorAll("label[for]").forEach(l => { l.htmlFor = "edit-" + l.htmlFor; });
    if (STATUS_OPTIONS[sheet]) {
        const wrap = document.createElement("div");
        wrap.innerHTML = `<label for="edit-status">Статус</label><select id="edit-status" name="status">${STATUS_OPTIONS[sheet].map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
        form.querySelector('button[type="submit"]').before(...wrap.childNodes);
    }
    // В форме добавления список тестов отфильтрован по выбранному ученику — в окне правки нужны все.
    const testSel = form.querySelector('select[name="testId"]');
    if (testSel) testSel.innerHTML = '<option value="">Без теста</option>' + state.tests.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("");
    form.querySelectorAll("[name]").forEach(el => {
        const v = rec[el.name];
        el.value = v == null ? "" : String(v);
    });
    const submit = form.querySelector('button[type="submit"]');
    submit.textContent = "Сохранить изменения";
    const actions = document.createElement("div");
    actions.className = "form-actions";
    actions.innerHTML = '<button type="button" data-close>Отмена</button>';
    submit.replaceWith(actions);
    actions.appendChild(submit);
    form.insertAdjacentHTML("afterbegin", '<h3>Изменить запись</h3>');
    editDlg.innerHTML = "";
    editDlg.appendChild(form);
    form.querySelectorAll("[data-preview-for]").forEach(out => mathPreview(form.querySelector("#" + out.dataset.previewFor), out));
    actions.querySelector("[data-close]").onclick = () => editDlg.close();
    form.addEventListener("submit", async e => {
        e.preventDefault();
        submit.disabled = true; submit.textContent = "Сохраняем…";
        try {
            await apiPost(Object.assign({ action:"updateRow", sheet, id }, formData(form)));
            editDlg.close();
            await loadData();
            showToast("Изменения сохранены");
        } catch (err) { submit.disabled = false; submit.textContent = "Сохранить изменения"; showToast("Не удалось сохранить: " + err.message, true); }
    });
    editDlg.showModal();
    form.querySelector("input:not([type=hidden]), select, textarea")?.focus();
}
document.querySelector("main").addEventListener("click", e => {
    const b = e.target.closest("[data-edit-sheet]");
    if (b) openEdit(b.dataset.editSheet, b.dataset.editId);
});

/* ---------- Поиск в разделах ---------- */

const LEAVES = "tbody tr:not(.answers-row), .item, .lesson-note, .message, .class-row";
function applySearch(panel) {
    const input = panel.querySelector(".panel-search input");
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    const scope = [...panel.children].filter(el => !el.classList.contains("panel-search") && !el.classList.contains("form-fold"));
    const leaves = scope.flatMap(el => [...el.querySelectorAll(LEAVES)]);
    leaves.forEach(el => el.classList.toggle("search-hide", !!q && !el.textContent.toLowerCase().includes(q)));
    const folds = scope.flatMap(el => [...el.querySelectorAll("details.fold:not(.form-fold)")]).reverse();
    folds.forEach(d => {
        if (!q) { d.classList.remove("search-hide"); return; }
        const title = d.querySelector(":scope > summary").textContent.toLowerCase().includes(q);
        const visible = [...d.querySelectorAll(LEAVES)].some(el => !el.classList.contains("search-hide"));
        d.classList.toggle("search-hide", !title && !visible);
        if (visible && !d.open) d.open = true;
    });
    const count = panel.querySelector(".search-count");
    count.textContent = q ? `найдено: ${leaves.filter(el => !el.classList.contains("search-hide")).length}` : "";
}
document.querySelectorAll("main > .tab-panel").forEach(panel => {
    if (["t-overview", "t-gallery", "t-messages"].includes(panel.id)) return;
    const bar = document.createElement("div");
    bar.className = "panel-search";
    bar.innerHTML = '<input type="search" placeholder="Поиск в разделе: имя, тема, текст…" aria-label="Поиск в разделе"><span class="search-count"></span>';
    panel.prepend(bar);
    bar.querySelector("input").addEventListener("input", () => applySearch(panel));
});
const reapplySearch = () => document.querySelectorAll("main > .tab-panel").forEach(applySearch);

/* ---------- Задание сразу нескольким ученикам ---------- */

function fillAlsoStudents() {
    const box = document.querySelector("[data-also]");
    if (!box) return;
    const main = document.getElementById("studentSelect").value;
    const checked = new Set([...box.querySelectorAll("input:checked")].map(i => i.value));
    const list = students().filter(u => u.username !== main);
    const grades = [...new Set(list.map(u => u.grade).filter(Boolean))].sort((a, b) => a - b);
    box.innerHTML = list.length ? `<div class="checks-tools">${grades.map(g => `<button type="button" data-also-grade="${esc(g)}">Весь ${esc(g)} класс</button>`).join("")}<button type="button" data-also-none>Снять всё</button></div>`
        + list.map(u => `<label><input type="checkbox" name="also" value="${esc(u.username)}"${checked.has(u.username) ? " checked" : ""}> ${esc(u.name)}${u.grade ? `, ${esc(u.grade)} кл.` : ""}</label>`).join("")
        : '<span class="muted small">Других учеников нет.</span>';
}
document.querySelector("[data-also]")?.addEventListener("click", e => {
    const g = e.target.closest("[data-also-grade]"), none = e.target.closest("[data-also-none]");
    if (!g && !none) return;
    document.querySelectorAll("[data-also] input").forEach(i => {
        if (none) i.checked = false;
        else if (String((state.users.find(u => u.username === i.value) || {}).grade) === g.dataset.alsoGrade) i.checked = true;
    });
});
document.getElementById("studentSelect").addEventListener("change", fillAlsoStudents);

if (adminUser) loadData();

