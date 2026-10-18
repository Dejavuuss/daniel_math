import { requireAuth, apiGet, apiPost, logout, today, DEMO } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { mountArt, QUOTES } from "./art.js";
import { esc, byDate, fmtDate, average, showToast, setStatus, initTabs, noteHtml, messageHtml, fold, groupBy, monthOf, classLabel } from "./ui.js";
import { createPicker, attach, attachmentsHtml, bindAttachments, filesFor } from "./files.js";
import { autoTypeset, mathPreview } from "./math.js";
import { mountTestBuilder } from "./test-builder.js";
import { reviewHtml, gradeRecords } from "./practice.js";
import { scoreOf, gradeFor } from "./quiz.js";

const adminUser = requireAuth("admin");
let state = null;

initPage();
initTabs();
mountArt(document.getElementById("art"), "athens");
rotateQuotes(document.getElementById("quote"), QUOTES.admin);
document.getElementById("logoutBtn").onclick = logout;
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
    document.getElementById("msgTo").innerHTML = state.users.filter(u => u.role !== "admin")
        .map(u => `<option value="${esc(u.username)}">${esc(u.name)} — ${u.role === "parent" ? "родитель" : "ученик"}</option>`).join("");
}

const nameOf = u => (state.users.find(x => x.username === u) || {}).name || u;
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

function table(rows, fields, collection) {
    if (!rows.length) return '<p class="empty-note">Записей пока нет.</p>';
    const cell = (r, f) => f === "url" || f === "link"
        ? (r[f] ? `<a href="${esc(r[f])}" target="_blank" rel="noopener noreferrer">открыть</a>` : "")
        : f === "files" ? filesCell(KIND[collection], r.id)
        : f === "student" || f === "child" ? esc(nameOf(r[f]))
        : f === "date" || f === "assigned" || f === "due" ? esc(fmtDate(r[f]))
        : f === "testId" ? esc((state.tests.find(t => t.id === r.testId) || {}).title || "")
        : f === "status" ? (r.status === "done" ? '<span class="badge done">сделано</span>' : '<span class="badge pending">в работе</span>')
        : esc(r[f]);
    return `<div class="table-wrap"><table><thead><tr>${fields.map(f => `<th>${f[1]}</th>`).join("")}${collection ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(r => `<tr>${fields.map(f => `<td>${cell(r, f[0])}</td>`).join("")}${collection ? `<td>${delBtn(collection, r.id)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
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

    const evFields = [["date","Дата"],["time","Время"],["type","Тип"],["title","Событие"],["student","Ученик"]];
    const upcoming = state.schedule.filter(e => String(e.date).slice(0, 10) >= now).sort(byDate), past = recent(state.schedule.filter(e => String(e.date).slice(0, 10) < now));
    document.getElementById("l-schedule").innerHTML = state.schedule.length
        ? fold("a-ev-next", "Предстоящие", table(upcoming, evFields, "schedule"), { open:true, count:upcoming.length })
          + fold("a-ev-past", "Прошедшие", table(past, evFields, "schedule"), { count:past.length })
        : empty("Событий пока нет.");

    renderGrades();

    document.getElementById("l-notes").innerHTML = state.lessonNotes.length
        ? byStudent(recent(state.lessonNotes)).map(([u, items]) => fold("a-notes-" + u, studentTitle(u),
            groupBy(items, n => monthOf(n.date)).map(([month, list]) => fold(`a-notes-${u}-${month}`, esc(month),
                list.map(n => noteHtml(n).replace("</article>", `${delBtn("lessonNotes", n.id)}</article>`)).join(""), { count:list.length })).join(""),
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
        ? byStudent(recent(state.achievements)).map(([u, items]) => fold("a-ach-" + u, studentTitle(u), items.map(a => `<article class="item"><div class="row"><h3>${esc(a.icon || "🏆")} ${esc(a.title)}</h3><span class="muted small">${esc(fmtDate(a.date))}</span></div>${a.description ? `<p class="muted">${esc(a.description)}</p>` : ""}${delBtn("achievements", a.id)}</article>`).join(""), { count:items.length })).join("")
        : empty("Достижений пока нет.");

    // Сообщения — по собеседникам; переписки с непрочитанными открыты.
    const partner = m => m.from === adminUser.username ? m.to : m.from;
    const order = state.users.filter(u => u.role !== "admin").sort((a, b) => a.name.localeCompare(b.name, "ru")).map(u => u.username);
    document.getElementById("l-messages").innerHTML = state.messages.length
        ? groupBy(recent(state.messages), partner, order).map(([u, items]) => {
            const unread = items.filter(m => m.to === adminUser.username && !m.isRead).length;
            return fold("a-msg-" + u, esc(nameOf(u)), items.map(m => messageHtml(m, adminUser.username, nameOf, filesCell("message", m.id))).join(""),
                { count:items.length, note:unread ? `новых ${unread}` : "последнее " + fmtDate(items[0].date), open:unread > 0 });
        }).join("")
        : empty("Сообщений пока нет.");

    document.getElementById("l-students").innerHTML = table(students(), [["name","Ученик"],["username","Логин"],["grade","Класс"]]);
    document.getElementById("l-parents").innerHTML = table(state.users.filter(u => u.role === "parent"), [["name","Родитель"],["username","Логин"],["child","Ученик"]]);

    renderTests();
    renderProblems();

    document.querySelectorAll("[data-delete-sheet]").forEach(btn => btn.onclick = async () => {
        if (!confirm(btn.dataset.confirm || "Удалить эту запись?")) return;
        btn.disabled = true;
        try { await apiPost({ action:"deleteRow", sheet:btn.dataset.deleteSheet, id:btn.dataset.deleteId }); await loadData(); showToast("Запись удалена"); }
        catch (e) { btn.disabled = false; showToast("Не удалось удалить: " + e.message, true); }
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
                <select data-set-grade="${esc(u.username)}" aria-label="Класс ученика">${options(u.grade)}</select></div>`;
        }).join(""), { open:true, count:items.length })).join("");
}

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
            ${delBtn("problems", p.id)}
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
function submitForm(id, action, done, files) {
    const form = document.getElementById(id);
    const picker = files ? createPicker(form.querySelector("[data-attach]")) : null;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]'), oldText = button.textContent;
        button.disabled = true; button.textContent = "Сохраняем…";
        let saved = false;
        try {
            const data = formData(form);
            const res = await apiPost(Object.assign({ action }, data));
            saved = true;
            if (picker && picker.files().length) {
                button.textContent = "Загружаем файлы…";
                await attach(files.kind, res.item.id, picker.files(), files.extra ? files.extra(data) : {});
            }
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
submitForm("f-homework", "addHomework", "Задание выдано", { kind:"homework", extra:d => ({ student:d.student }) });
submitForm("f-schedule", "addEvent", "Событие добавлено");
submitForm("f-grades", "addGrade", "Оценка сохранена");
submitForm("f-notes", "addLessonNote", "Заметка сохранена");
submitForm("f-payments", "addPayment", "Запись добавлена");
submitForm("f-achievements", "addAchievement", "Достижение выдано");
submitForm("f-messages", "addMessage", "Сообщение отправлено", { kind:"message", extra:d => ({ from:adminUser.username, to:d.to }) });
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

["l-materials", "l-homework", "l-messages"].forEach(id => bindAttachments(document.getElementById(id), () => state.files, loadData));

if (adminUser) loadData();

