// Конструктор теста в панели репетитора: вопросы трёх типов, варианты с отметкой правильного,
// предпросмотр формул. collect() отдаёт вопросы в формате действия addTest (js/auth.js).
import { mathPreview } from "./math.js";

let uid = 0;

export function mountTestBuilder(form) {
  const list = form.querySelector("[data-questions]");

  function optionRow(name, j) {
    const row = document.createElement("div");
    row.className = "q-option";
    row.innerHTML = `<input type="radio" name="${name}" aria-label="Правильный вариант">
      <input data-opt placeholder="Вариант ${j + 1}" aria-label="Вариант ответа">
      <button type="button" class="att-del" data-remove-option aria-label="Удалить вариант">✕</button>`;
    return row;
  }

  function addQuestion() {
    const id = ++uid, name = `correct-${id}`;
    const card = document.createElement("fieldset");
    card.className = "q-card";
    card.innerHTML = `<legend>Вопрос <span class="q-n"></span></legend>
      <button type="button" class="att-del q-remove" aria-label="Удалить вопрос">✕</button>
      <label for="q-text-${id}">Текст вопроса</label>
      <textarea id="q-text-${id}" data-q-text rows="2" placeholder="Например: найдите корни уравнения $x^2 - 9 = 0$"></textarea>
      <div class="math-preview" hidden></div>
      <label for="q-type-${id}">Тип ответа</label>
      <select id="q-type-${id}" data-q-type>
        <option value="choice">Выбор варианта</option>
        <option value="number">Число</option>
        <option value="text">Короткий ответ</option>
      </select>
      <div data-choice>
        <label>Варианты — отметьте правильный кружком</label>
        <div class="q-options"></div>
        <button type="button" data-add-option>Добавить вариант</button>
      </div>
      <div data-free hidden>
        <label for="q-answer-${id}">Правильный ответ</label>
        <input id="q-answer-${id}" data-q-answer placeholder="Несколько допустимых — через точку с запятой: 3; -3">
      </div>`;
    const options = card.querySelector(".q-options");
    for (let j = 0; j < 3; j++) options.appendChild(optionRow(name, j));
    mathPreview(card.querySelector("[data-q-text]"), card.querySelector(".math-preview"));

    card.querySelector("[data-q-type]").addEventListener("change", e => {
      const choice = e.target.value === "choice";
      card.querySelector("[data-choice]").hidden = !choice;
      card.querySelector("[data-free]").hidden = choice;
      card.querySelector("[data-q-answer]").placeholder = e.target.value === "number"
        ? "Число: 0,5 или 1/2; несколько — через точку с запятой" : "Слово или фраза; несколько — через точку с запятой";
    });
    card.addEventListener("click", e => {
      if (e.target.closest("[data-add-option]") && options.children.length < 6) options.appendChild(optionRow(name, options.children.length));
      const rm = e.target.closest("[data-remove-option]");
      if (rm && options.children.length > 2) rm.closest(".q-option").remove();
      if (e.target.closest(".q-remove") && list.children.length > 1) { card.remove(); renumber(); }
    });
    list.appendChild(card);
    renumber();
    return card;
  }

  function renumber() {
    [...list.children].forEach((c, i) => { c.querySelector(".q-n").textContent = i + 1; });
  }

  form.querySelector("[data-add-question]").addEventListener("click", () => {
    if (list.children.length >= 30) return;
    addQuestion().querySelector("[data-q-text]").focus();
  });

  addQuestion();

  return {
    collect() {
      return [...list.children].map(card => {
        const type = card.querySelector("[data-q-type]").value;
        const q = { text:card.querySelector("[data-q-text]").value, type, options:[], answer:"" };
        if (type === "choice") {
          const rows = [...card.querySelectorAll(".q-option")].filter(r => r.querySelector("[data-opt]").value.trim());
          q.options = rows.map(r => r.querySelector("[data-opt]").value.trim());
          const checked = rows.findIndex(r => r.querySelector('input[type="radio"]').checked);
          q.answer = checked >= 0 ? checked : "";
        } else {
          q.answer = card.querySelector("[data-q-answer]").value;
        }
        return q;
      });
    },
    reset() {
      list.innerHTML = "";
      addQuestion();
    }
  };
}
