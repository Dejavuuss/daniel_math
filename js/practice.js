// Тесты и банк задач для ученика (прохождение) и родителя (только просмотр результатов).
import { apiPost } from "./auth.js";
import { esc, fmtDate, showToast, fold } from "./ui.js";
import { isCorrect, scoreOf, checkProblem, keyLabel, gradeFor, SCALE_TEXT } from "./quiz.js";

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};
const questionsLabel = n => `${n} ${plural(n, "вопрос", "вопроса", "вопросов")}`;
const scoreClass = ({ correct, total }) => correct / total >= 0.75 ? "done" : correct / total >= 0.5 ? "pending" : "overdue";
const answerText = answer => String(answer).split(";").map(x => x.trim()).filter(Boolean).join(" или ");

/* ---------- Разбор результата (общий для ученика, родителя и репетитора) ---------- */

export function reviewHtml(test, key, answers) {
  const s = scoreOf(test, key, answers);
  return `<div class="test-score ${scoreClass(s)}"><strong>${s.correct}<span> из ${s.total}</span></strong><span>верных ответов, оценка «${gradeFor(s.correct, s.total)}»</span></div>
  <ol class="review">${test.questions.map((q, i) => {
    const ok = isCorrect(q, key[i], answers[i]);
    const given = answers[i] === "" || answers[i] == null ? "нет ответа" : q.type === "choice" ? (q.options[Number(answers[i])] ?? "") : answers[i];
    return `<li class="${ok ? "right" : "wrong"}">
      <div class="review-q">${esc(q.text)}</div>
      <div class="review-a"><span class="mark" aria-label="${ok ? "верно" : "неверно"}">${ok ? "✓" : "✗"}</span> Ответ: ${esc(given)}</div>
      ${ok ? "" : `<div class="review-key">Правильно: ${esc(keyLabel(q, key[i]))}</div>`}
    </li>`;
  }).join("")}</ol>`;
}

/* ---------- Успеваемость ---------- */

// Все оценки: выставленные репетитором, за тренировки на оценку и за тесты (по той же шкале).
// student — чьи (пусто — все). Поля как у grades: student, date, grade, subject, comment; kind — откуда оценка.
export function gradeRecords(state, student) {
  const own = r => !student || r.student === student;
  const tests = new Map(state.tests.map(t => [t.id, t]));
  return [
    ...state.grades.filter(own).map(g => Object.assign({ kind:"lesson" }, g)),
    ...(state.practiceResults || []).filter(own).map(r => ({ id:r.id, kind:"practice", student:r.student, date:r.date, grade:r.grade,
      subject:"Тренировка: " + r.topic, comment:`${r.correct} из ${r.total}` })),
    ...state.testResults.filter(own).flatMap(r => {
      const t = tests.get(r.testId), key = state.testKeys[r.testId];
      if (!t || !key) return [];
      const s = scoreOf(t, key, r.answers);
      return [{ id:r.id, kind:"test", student:r.student, date:r.date, grade:gradeFor(s.correct, s.total),
        subject:"Тест: " + t.title, comment:`${s.correct} из ${s.total}` }];
    })
  ];
}

/* ---------- Тесты ---------- */

// opts: tests, results, keys ({testId: answers}), grade, canTake, onSubmitted(testId, answers, key)
// Показываются тесты класса ученика, индивидуальные и общие (без класса).
export function mountTests(box, opts) {
  let view = { mode:"list" };
  const resultOf = id => opts.results.find(r => r.testId === id);
  const visible = () => opts.tests.filter(t => t.student || !t.grade || !opts.grade || String(t.grade) === String(opts.grade))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  function card(t) {
    const r = resultOf(t.id), key = opts.keys[t.id];
    const s = r && key ? scoreOf(t, key, r.answers) : null;
    const badge = s ? `<span class="badge ${scoreClass(s)}">${s.correct} из ${s.total}, «${gradeFor(s.correct, s.total)}»</span>`
      : r ? '<span class="badge plain">сдан</span>' : '<span class="badge plain">не пройден</span>';
    const action = !r && opts.canTake ? `<button class="primary" data-take="${esc(t.id)}">Начать тест</button>`
      : s ? `<button data-review="${esc(t.id)}">Разбор ответов</button>` : "";
    return `<article class="item test-card">
      <div class="row"><h3>${esc(t.title)}</h3>${badge}</div>
      <p class="muted small">${[t.topic, questionsLabel(t.questions.length), t.grade ? t.grade + " класс" : "", r ? "сдан " + fmtDate(r.date) : ""].filter(Boolean).map(esc).join(", ")}</p>
      ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ""}
      ${action ? `<div class="hw-actions">${action}</div>` : ""}
    </article>`;
  }

  function list() {
    const tests = visible();
    if (!tests.length) return '<p class="muted">Тестов для твоего класса пока нет.</p>';
    const todo = tests.filter(t => !resultOf(t.id)), done = tests.filter(t => resultOf(t.id));
    return fold("tests-todo", "Не пройдены", todo.length ? todo.map(card).join("") : '<p class="empty-note">Все тесты пройдены.</p>', { open:true, count:todo.length })
      + fold("tests-done", "Пройдены", done.length ? done.map(card).join("") : '<p class="empty-note">Пока ни одного.</p>', { count:done.length });
  }

  function take(t) {
    return `<div class="test-run">
      <div class="test-head"><button type="button" data-back>К списку тестов</button><div><h3>${esc(t.title)}</h3><span class="muted small">${questionsLabel(t.questions.length)}. Ответы можно отправить один раз. ${SCALE_TEXT}.</span></div></div>
      <form class="test-form" novalidate>
        ${t.questions.map((q, i) => `<fieldset class="question">
          <legend><span class="q-num">${i + 1}</span><span class="q-text">${esc(q.text)}</span></legend>
          ${q.type === "choice"
            ? `<div class="options">${q.options.map((o, j) => `<label class="option"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>`
            : `<input name="q${i}" autocomplete="off" ${q.type === "number" ? 'inputmode="decimal" placeholder="Число, например 0,5 или 1/2"' : 'placeholder="Ваш ответ"'}>`}
        </fieldset>`).join("")}
        <button class="primary" type="submit">Отправить ответы</button>
      </form>
    </div>`;
  }

  function review(t) {
    const r = resultOf(t.id), key = opts.keys[t.id];
    return `<div class="test-run">
      <div class="test-head"><button type="button" data-back>К списку тестов</button><div><h3>${esc(t.title)}</h3><span class="muted small">Сдан ${esc(fmtDate(r.date))}</span></div></div>
      ${reviewHtml(t, key, r.answers)}
    </div>`;
  }

  function render() {
    const t = view.id && opts.tests.find(x => x.id === view.id);
    box.innerHTML = view.mode === "take" && t ? take(t) : view.mode === "review" && t && resultOf(t.id) && opts.keys[t.id] ? review(t) : list();
    if (view.mode !== "list") box.scrollIntoView({ block:"start", behavior:"smooth" });
    const form = box.querySelector(".test-form");
    if (form) form.addEventListener("submit", e => submit(e, t, form));
  }

  async function submit(e, t, form) {
    e.preventDefault();
    const data = new FormData(form);
    const answers = t.questions.map((_, i) => String(data.get(`q${i}`) ?? "").trim());
    const empty = answers.filter(a => !a).length;
    if (!confirm(`Изменить ответы после отправки будет нельзя.${empty ? ` Без ответа: ${empty}.` : ""} Отправить?`)) return;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Проверяем…";
    try {
      const res = await apiPost({ action:"submitTest", testId:t.id, answers });
      await opts.onSubmitted(t.id, answers, res.key);
      view = { mode:"review", id:t.id };
      render();
      showToast("Ответы отправлены");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Отправить ответы";
      showToast("Не удалось отправить: " + err.message, true);
    }
  }

  box.onclick = e => {
    const takeBtn = e.target.closest("[data-take]"), reviewBtn = e.target.closest("[data-review]"), back = e.target.closest("[data-back]");
    if (takeBtn) { view = { mode:"take", id:takeBtn.dataset.take }; render(); }
    else if (reviewBtn) { view = { mode:"review", id:reviewBtn.dataset.review }; render(); }
    else if (back) { view = { mode:"list" }; render(); }
  };
  render();
  return {
    update(next) { Object.assign(opts, next); render(); },
    // Открыть тест (например, из домашнего задания): непройденный — для прохождения, сданный — разбор.
    open(id) { view = { mode:resultOf(id) ? "review" : opts.canTake ? "take" : "list", id }; render(); }
  };
}

/* ---------- Банк задач ---------- */

const dots = n => `<span class="difficulty" aria-label="Сложность ${n} из 3">${"●".repeat(n)}${"○".repeat(3 - n)}</span>`;
const GRADED_SIZE = 5;

// Задачи только класса ученика (и без класса). Две части:
//  • «На оценку»: 5 случайных задач, засчитывается первый ответ, оценка по шкале → в успеваемость (onSaved);
//  • «Свободная тренировка»: темы-группы, сколько угодно попыток, решения. Решённое помнит браузер.
export function mountBank(box, problems, storageKey, opts = {}) {
  const grade = opts.grade || "";
  const pool = problems.filter(p => !grade || p.grade == null || String(p.grade) === String(grade));
  let session = null, solved = new Set();
  try { solved = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch (_) {}
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify([...solved])); } catch (_) {} };
  const topics = [...new Set(pool.map(p => p.topic))].sort((a, b) => a.localeCompare(b, "ru"));
  const solvedNote = list => `решено ${list.filter(p => solved.has(p.id)).length} из ${list.length}`;

  function gradedHtml() {
    if (!opts.canGrade) return `<p class="empty-note">Тренировку на оценку проходит ученик в своём кабинете. ${SCALE_TEXT}.</p>`;
    if (!session) return `<p class="scale-note">${GRADED_SIZE} случайных задач, засчитывается первый ответ. ${SCALE_TEXT}. Оценка сразу попадёт в успеваемость.</p>
      <div class="graded-start"><select data-graded-topic aria-label="Тема"><option value="">Все темы класса</option>${topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
      <button class="primary" type="button" data-start-graded>Начать</button></div>`;
    if (!session.result) return `<form class="graded-form" novalidate>
        <p class="muted small">${esc(session.topic || "Все темы класса")}: ${session.items.length} задач. Ответ можно дать один раз.</p>
        ${session.items.map((p, i) => `<fieldset class="question"><legend><span class="q-num">${i + 1}</span><span class="q-text">${esc(p.text)}</span></legend>
          <input name="a${i}" autocomplete="off" placeholder="Ваш ответ; несколько — через «;»" aria-label="Ответ на задачу ${i + 1}"></fieldset>`).join("")}
        <div class="form-actions"><button type="button" data-cancel-graded>Отменить</button><button class="primary" type="submit">Завершить и получить оценку</button></div>
      </form>`;
    const r = session.result;
    return `<div class="test-score ${scoreClass(r)}"><strong>${r.correct}<span> из ${r.total}</span></strong><span>оценка «${r.grade}» — добавлена в успеваемость</span></div>
      <ol class="review">${session.items.map((p, i) => {
        const ok = r.marks[i];
        return `<li class="${ok ? "right" : "wrong"}"><div class="review-q">${esc(p.text)}</div>
          <div class="review-a"><span class="mark">${ok ? "✓" : "✗"}</span> Ответ: ${esc(r.answers[i] || "нет ответа")}</div>
          ${ok ? "" : `<div class="review-key">Правильно: ${esc(answerText(p.answer))}</div>`}</li>`;
      }).join("")}</ol>
      <div class="form-actions"><button class="primary" type="button" data-again>Пройти ещё раз</button></div>`;
  }

  function problemCard(p) {
    return `<article class="item problem${solved.has(p.id) ? " solved" : ""}" data-id="${esc(p.id)}">
      <div class="row"><span class="muted small">${p.grade ? `${esc(p.grade)} класс` : "для всех"}</span>${dots(p.difficulty)}</div>
      <div class="problem-text">${esc(p.text)}</div>
      <form class="problem-check" novalidate>
        <input name="answer" autocomplete="off" placeholder="Ваш ответ; несколько — через «;»" aria-label="Ответ">
        <button type="submit">Проверить</button>
        <span class="feedback" role="status"></span>
      </form>
      <details class="problem-solution"><summary>${p.solution ? "Показать решение" : "Показать ответ"}</summary>
        <p><b>Ответ:</b> ${esc(answerText(p.answer))}</p>
        ${p.solution ? `<p>${esc(p.solution)}</p>` : ""}
      </details>
    </article>`;
  }

  function render() {
    if (!pool.length) { box.innerHTML = `<p class="muted">${grade ? `Для ${esc(grade)} класса задач пока нет.` : "Задач пока нет."}</p>`; return; }
    box.innerHTML = (opts.noGradeNote ? `<p class="scale-note">${esc(opts.noGradeNote)}</p>` : "")
      + fold("bank-graded", "Тренировка на оценку", gradedHtml(), { open:true })
      + `<h3 class="bank-sub">Свободная тренировка</h3>`
      + topics.map(t => {
        const list = pool.filter(p => p.topic === t).sort((a, b) => a.difficulty - b.difficulty);
        return fold(`bank-topic-${t}`, esc(t), list.map(problemCard).join(""), { note:solvedNote(list), count:list.length });
      }).join("");
  }

  function startSession() {
    const topic = box.querySelector("[data-graded-topic]").value;
    const from = pool.filter(p => !topic || p.topic === topic).slice().sort(() => Math.random() - 0.5);
    session = { topic, items:from.slice(0, Math.min(GRADED_SIZE, from.length)) };
    render();
    box.querySelector(".graded-form input")?.focus();
  }

  async function finishSession(form) {
    const answers = session.items.map((_, i) => String(form[`a${i}`].value || "").trim());
    const empty = answers.filter(a => !a).length;
    if (empty && !confirm(`Без ответа: ${empty}. Завершить?`)) return;
    const marks = session.items.map((p, i) => checkProblem(p.answer, answers[i]));
    const correct = marks.filter(Boolean).length, total = session.items.length;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Сохраняем…";
    try {
      const res = await apiPost({ action:"savePractice", topic:session.topic || "Все темы класса", correct, total });
      session.result = { correct, total, grade:res.item.grade, answers, marks };
      opts.onSaved && opts.onSaved(res.item);
      render();
      showToast(`Оценка «${res.item.grade}» добавлена в успеваемость`);
    } catch (err) {
      btn.disabled = false; btn.textContent = "Завершить и получить оценку";
      showToast("Не удалось сохранить: " + err.message, true);
    }
  }

  box.onclick = e => {
    if (e.target.closest("[data-start-graded]")) startSession();
    else if (e.target.closest("[data-cancel-graded]") || e.target.closest("[data-again]")) { session = null; render(); }
  };
  box.onsubmit = e => {
    const graded = e.target.closest(".graded-form");
    if (graded) { e.preventDefault(); finishSession(graded); return; }
    const form = e.target.closest(".problem-check");
    if (!form) return;
    e.preventDefault();
    const card = form.closest(".problem"), p = pool.find(x => x.id === card.dataset.id);
    const given = form.answer.value, fb = form.querySelector(".feedback");
    if (!given.trim()) { fb.textContent = "Введите ответ"; return; }
    const ok = checkProblem(p.answer, given);
    fb.textContent = ok ? "Верно!" : "Пока неверно — попробуйте ещё";
    fb.className = "feedback " + (ok ? "ok" : "bad");
    card.classList.remove("shake"); void card.offsetWidth;
    if (ok) {
      card.classList.add("solved"); solved.add(p.id); save();
      const note = card.closest(".fold")?.querySelector(".fold-note");
      if (note) note.textContent = solvedNote(pool.filter(x => x.topic === p.topic));
    } else card.classList.add("shake");
  };
  render();
}
