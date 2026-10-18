// Тесты и банк задач для ученика (прохождение) и родителя (только просмотр результатов).
import { apiPost } from "./auth.js";
import { esc, fmtDate, showToast } from "./ui.js";
import { isCorrect, scoreOf, checkProblem, keyLabel } from "./quiz.js";

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};
const questionsLabel = n => `${n} ${plural(n, "вопрос", "вопроса", "вопросов")}`;
const scoreClass = ({ correct, total }) => correct / total >= 0.8 ? "done" : correct / total >= 0.5 ? "pending" : "overdue";

/* ---------- Разбор результата (общий для ученика, родителя и репетитора) ---------- */

export function reviewHtml(test, key, answers) {
  const s = scoreOf(test, key, answers);
  return `<div class="test-score ${scoreClass(s)}"><strong>${s.correct}<span> из ${s.total}</span></strong><span>верных ответов</span></div>
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

/* ---------- Тесты ---------- */

// opts: tests, results, keys ({testId: answers}), grade, canTake, onSubmitted(testId, answers, key)
export function mountTests(box, opts) {
  let view = { mode:"list" };
  const resultOf = id => opts.results.find(r => r.testId === id);
  const visible = () => opts.tests.filter(t => t.student || !t.grade || !opts.grade || String(t.grade) === String(opts.grade))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  function list() {
    const tests = visible();
    if (!tests.length) return '<p class="muted">Тестов пока нет.</p>';
    return tests.map(t => {
      const r = resultOf(t.id), key = opts.keys[t.id];
      const s = r && key ? scoreOf(t, key, r.answers) : null;
      const badge = s ? `<span class="badge ${scoreClass(s)}">${s.correct} из ${s.total}</span>`
        : r ? '<span class="badge plain">сдан</span>' : '<span class="badge plain">не пройден</span>';
      const action = !r && opts.canTake ? `<button class="primary" data-take="${esc(t.id)}">Начать тест</button>`
        : s ? `<button data-review="${esc(t.id)}">Разбор ответов</button>` : "";
      return `<article class="item test-card">
        <div class="row"><h3>${esc(t.title)}</h3>${badge}</div>
        <p class="muted small">${[t.topic, questionsLabel(t.questions.length), t.grade ? t.grade + " класс" : "", r ? "сдан " + fmtDate(r.date) : ""].filter(Boolean).map(esc).join(", ")}</p>
        ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ""}
        ${action ? `<div class="hw-actions">${action}</div>` : ""}
      </article>`;
    }).join("");
  }

  function take(t) {
    return `<div class="test-run">
      <div class="test-head"><button type="button" data-back>К списку тестов</button><div><h3>${esc(t.title)}</h3><span class="muted small">${questionsLabel(t.questions.length)}. Ответы можно отправить один раз.</span></div></div>
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
    box.innerHTML = view.mode === "take" && t ? take(t) : view.mode === "review" && t ? review(t) : list();
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
      opts.onSubmitted(t.id, answers, res.key);
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
  return { update(next) { Object.assign(opts, next); render(); } };
}

/* ---------- Банк задач ---------- */

const dots = n => `<span class="difficulty" aria-label="Сложность ${n} из 3">${"●".repeat(n)}${"○".repeat(3 - n)}</span>`;

// Решённые задачи запоминаются в браузере ученика (storageKey — свой для каждого логина).
export function mountBank(box, problems, storageKey) {
  let topic = "", solved = new Set();
  try { solved = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch (_) {}
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify([...solved])); } catch (_) {} };
  const topics = [...new Set(problems.map(p => p.topic))].sort((a, b) => a.localeCompare(b, "ru"));

  function render() {
    if (!problems.length) { box.innerHTML = '<p class="muted">Задач пока нет.</p>'; return; }
    const list = problems.filter(p => !topic || p.topic === topic).sort((a, b) => a.difficulty - b.difficulty);
    const done = list.filter(p => solved.has(p.id)).length;
    box.innerHTML = `<div class="bank-filters" role="group" aria-label="Тема">
        <button type="button" class="chip${topic ? "" : " active"}" data-topic="">Все темы</button>
        ${topics.map(t => `<button type="button" class="chip${t === topic ? " active" : ""}" data-topic="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>
      <div class="bank-progress"><span style="--p:${list.length ? done / list.length * 100 : 0}%"></span><b>Решено ${done} из ${list.length}</b></div>
      ${list.map(p => `<article class="item problem${solved.has(p.id) ? " solved" : ""}" data-id="${esc(p.id)}">
        <div class="row"><span class="muted small">${esc(p.topic)}${p.grade ? `, ${esc(p.grade)} класс` : ""}</span>${dots(p.difficulty)}</div>
        <div class="problem-text">${esc(p.text)}</div>
        <form class="problem-check" novalidate>
          <input name="answer" autocomplete="off" placeholder="Ваш ответ" aria-label="Ответ">
          <button type="submit">Проверить</button>
          <span class="feedback" role="status"></span>
        </form>
        <details class="problem-solution"><summary>${p.solution ? "Показать решение" : "Показать ответ"}</summary>
          <p><b>Ответ:</b> ${esc(p.answer.split(";").map(x => x.trim()).filter(Boolean).join(" или "))}</p>
          ${p.solution ? `<p>${esc(p.solution)}</p>` : ""}
        </details>
      </article>`).join("")}`;
  }

  box.onclick = e => {
    const chip = e.target.closest("[data-topic]");
    if (chip) { topic = chip.dataset.topic; render(); }
  };
  box.onsubmit = e => {
    const form = e.target.closest(".problem-check");
    if (!form) return;
    e.preventDefault();
    const card = form.closest(".problem"), p = problems.find(x => x.id === card.dataset.id);
    const given = form.answer.value, fb = form.querySelector(".feedback");
    if (!given.trim()) { fb.textContent = "Введите ответ"; return; }
    const ok = checkProblem(p.answer, given);
    fb.textContent = ok ? "Верно!" : "Пока неверно — попробуйте ещё";
    fb.className = "feedback " + (ok ? "ok" : "bad");
    card.classList.remove("shake"); void card.offsetWidth;
    if (ok) { card.classList.add("solved"); solved.add(p.id); save(); updateProgress(); }
    else card.classList.add("shake");
  };
  function updateProgress() {
    const list = problems.filter(p => !topic || p.topic === topic);
    const done = list.filter(p => solved.has(p.id)).length;
    const bar = box.querySelector(".bank-progress");
    if (bar) { bar.querySelector("span").style.setProperty("--p", `${done / list.length * 100}%`); bar.querySelector("b").textContent = `Решено ${done} из ${list.length}`; }
  }
  render();
}
