import { requireAuth, apiGet, apiPost, logout, today, DEMO } from "./auth.js";
import { initPage, countUp, rotateQuotes } from "./fx.js";
import { mountArt, QUOTES } from "./art.js";
import { esc, byDate, showToast, setStatus, initTabs, noteHtml, messageHtml } from "./ui.js";
import { createPicker, attach, attachmentsHtml, bindAttachments, filesFor } from "./files.js";
import { autoTypeset, mathPreview } from "./math.js";
import { mountTestBuilder } from "./test-builder.js";
import { reviewHtml } from "./practice.js";
import { scoreOf } from "./quiz.js";

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

function table(rows, fields, collection) {
    if (!rows.length) return '<p class="muted">Записей пока нет.</p>';
    const cell = (r, f) => f === "url" || f === "link"
        ? (r[f] ? `<a href="${esc(r[f])}" target="_blank" rel="noopener noreferrer">открыть</a>` : "")
        : f === "files" ? filesCell(KIND[collection], r.id)
        : f === "student" || f === "child" ? esc(nameOf(r[f])) : esc(r[f]);
    return `<div class="table-wrap"><table><thead><tr>${fields.map(f => `<th>${f[1]}</th>`).join("")}${collection ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(r => `<tr>${fields.map(f => `<td>${cell(r, f[0])}</td>`).join("")}${collection ? `<td><button class="danger" data-delete-sheet="${collection}" data-delete-id="${esc(r.id)}">Удалить</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function renderLists() {
    const recent = list => list.slice().sort(byDate).reverse();
    document.getElementById("l-materials").innerHTML = table(state.materials, [["title","Название"],["grade","Класс"],["topic","Тема"],["url","Ссылка"],["files","Файлы"]], "materials");
    document.getElementById("l-homework").innerHTML = table(state.homework.slice().sort((a, b) => String(b.due).localeCompare(String(a.due))), [["student","Ученик"],["title","Задание"],["assigned","Выдано"],["due","Сдать до"],["status","Статус"],["link","Ссылка"],["files","Файлы"]], "homework");
    document.getElementById("l-schedule").innerHTML = table(recent(state.schedule), [["date","Дата"],["time","Время"],["type","Тип"],["title","Событие"],["student","Ученик"]], "schedule");
    document.getElementById("l-grades").innerHTML = table(recent(state.grades), [["student","Ученик"],["subject","Предмет"],["grade","Оценка"],["date","Дата"],["comment","Комментарий"]], "grades");
    document.getElementById("l-payments").innerHTML = table(recent(state.payments), [["student","Ученик"],["date","Дата"],["amount","Сумма"],["type","Тип"],["description","Описание"]], "payments");
    document.getElementById("l-students").innerHTML = table(state.users.filter(u => u.role === "student"), [["name","Ученик"],["username","Логин"],["grade","Класс"]]);
    document.getElementById("l-parents").innerHTML = table(state.users.filter(u => u.role === "parent"), [["name","Родитель"],["username","Логин"],["child","Ученик"]]);
    document.getElementById("l-notes").innerHTML = state.lessonNotes.length
        ? recent(state.lessonNotes).map(n => noteHtml(n, nameOf(n.student)).replace("</article>", `<button class="danger" data-delete-sheet="lessonNotes" data-delete-id="${esc(n.id)}">Удалить</button></article>`)).join("")
        : '<p class="muted">Заметок пока нет.</p>';
    document.getElementById("l-achievements").innerHTML = state.achievements.length
        ? recent(state.achievements).map(a => `<article class="item"><div class="row"><h3>${esc(a.icon || "🏆")} ${esc(a.title)}</h3><span class="badge gold">${esc(nameOf(a.student))}</span></div>${a.description ? `<p class="muted">${esc(a.description)}</p>` : ""}<button class="danger" data-delete-sheet="achievements" data-delete-id="${esc(a.id)}">Удалить</button></article>`).join("")
        : '<p class="muted">Достижений пока нет.</p>';
    document.getElementById("l-messages").innerHTML = state.messages.length
        ? recent(state.messages).map(m => messageHtml(m, adminUser.username, nameOf, filesCell("message", m.id))).join("")
        : '<p class="muted">Сообщений пока нет.</p>';

    renderTests();
    renderProblems();

    document.querySelectorAll("[data-delete-sheet]").forEach(btn => btn.onclick = async () => {
        if (!confirm(btn.dataset.confirm || "Удалить эту запись?")) return;
        btn.disabled = true;
        try { await apiPost({ action:"deleteRow", sheet:btn.dataset.deleteSheet, id:btn.dataset.deleteId }); await loadData(); showToast("Запись удалена"); }
        catch (e) { btn.disabled = false; showToast("Не удалось удалить: " + e.message, true); }
    });
}

// Тесты: у каждого — кто сдал (балл считается из ответов и ключа) и кто ещё нет.
function renderTests() {
    const box = document.getElementById("l-tests");
    const tests = state.tests.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!tests.length) { box.innerHTML = '<p class="muted">Тестов пока нет.</p>'; return; }
    const students = state.users.filter(u => u.role === "student");
    box.innerHTML = tests.map(t => {
        const key = state.testKeys[t.id] || [];
        const results = state.testResults.filter(r => r.testId === t.id);
        const audience = t.student ? [students.find(s => s.username === t.student)].filter(Boolean)
            : students.filter(s => !t.grade || String(s.grade) === String(t.grade));
        const missing = audience.filter(s => !results.some(r => r.student === s.username));
        return `<article class="item test-admin">
            <div class="row"><h3>${esc(t.title)}</h3><span class="badge plain">${t.student ? esc(nameOf(t.student)) : t.grade ? `все, ${esc(t.grade)} класс` : "все ученики"}</span></div>
            <p class="muted small">${[t.topic, t.questions.length + " вопр.", "создан " + t.date].filter(Boolean).map(esc).join(", ")}</p>
            ${results.length ? `<div class="table-wrap"><table><thead><tr><th>Ученик</th><th>Результат</th><th>Сдан</th><th></th></tr></thead><tbody>
                ${results.map(r => { const s = scoreOf(t, key, r.answers); return `<tr>
                    <td>${esc(nameOf(r.student))}</td><td><strong>${s.correct} из ${s.total}</strong></td><td>${esc(r.date)}</td>
                    <td class="cell-actions"><button data-show-answers="${esc(r.id)}">Ответы</button>
                    <button class="danger" data-delete-sheet="testResults" data-delete-id="${esc(r.id)}" data-confirm="Удалить результат? Ученик сможет пройти тест заново.">Пересдать</button></td></tr>
                    <tr class="answers-row" id="answers-${esc(r.id)}" hidden><td colspan="4">${reviewHtml(t, key, r.answers)}</td></tr>`; }).join("")}
            </tbody></table></div>` : '<p class="muted small">Ещё никто не сдал.</p>'}
            ${missing.length ? `<p class="muted small">Не сдали: ${missing.map(s => esc(s.name)).join(", ")}</p>` : ""}
            <button class="danger" data-delete-sheet="tests" data-delete-id="${esc(t.id)}" data-confirm="Удалить тест вместе с результатами?">Удалить тест</button>
        </article>`;
    }).join("");
    box.querySelectorAll("[data-show-answers]").forEach(b => b.onclick = () => {
        const row = document.getElementById("answers-" + b.dataset.showAnswers);
        row.hidden = !row.hidden;
        b.textContent = row.hidden ? "Ответы" : "Скрыть";
    });
}

function renderProblems() {
    const box = document.getElementById("l-problems");
    const topics = [...new Set(state.problems.map(p => p.topic))].sort((a, b) => a.localeCompare(b, "ru"));
    document.getElementById("topicList").innerHTML = topics.map(t => `<option value="${esc(t)}">`).join("");
    if (!state.problems.length) { box.innerHTML = '<p class="muted">Задач пока нет.</p>'; return; }
    box.innerHTML = topics.map(topic => {
        const list = state.problems.filter(p => p.topic === topic).sort((a, b) => a.difficulty - b.difficulty);
        return `<h3 class="bank-topic">${esc(topic)} <span class="muted small">${list.length}</span></h3>${list.map(p => `<article class="item compact problem-admin">
            <div class="row"><span class="difficulty" aria-label="Сложность ${p.difficulty} из 3">${"●".repeat(p.difficulty)}${"○".repeat(3 - p.difficulty)}</span>${p.grade ? `<span class="badge plain">${esc(p.grade)} класс</span>` : ""}</div>
            <div class="problem-text">${esc(p.text)}</div>
            <p class="muted small">Ответ: ${esc(p.answer)}</p>
            <button class="danger" data-delete-sheet="problems" data-delete-id="${esc(p.id)}">Удалить</button>
        </article>`).join("")}`;
    }).join("");
}

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

