// Проверка content/content.json перед загрузкой: формат, лимиты правил, приём ответов проверкой сайта
// и независимый пересчёт ответов для основных типов задач (по тексту условия).
import { readFileSync } from "node:fs";
import { parseNumber, checkProblem, isCorrect } from "../js/quiz.js";

const { problems, tests, materials } = JSON.parse(readFileSync(new URL("./content.json", import.meta.url), "utf8"));
const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const strOk = (s, min, max) => typeof s === "string" && s.length >= min && s.length <= max;
const n = s => parseNumber(s);

// Огрехи записи формул.
const ugly = [[/\+ -/, "«+ -»"], [/- -/, "«- -»"], [/(^|[^\d.,])1x/, "«1x»"], [/\+ 0(?![\d,.{])/, "«+ 0»"], [/\\cdot -/, "отрицательный множитель без скобок"], [/  /, "двойной пробел"], [/\$\s*\$/, "пустая формула"], [/undefined|NaN/, "undefined/NaN"]];
const lint = (id, text) => ugly.forEach(([re, what]) => { if (re.test(text)) err(id, `${what} в «${text.slice(0, 70)}»`); });

for (const p of problems) {
  if (!strOk(p.topic, 1, 200) || !strOk(p.text, 1, 4000) || !strOk(p.answer, 1, 300) || !strOk(p.solution, 0, 4000)) err(p.id, "длина поля");
  if (!(p.grade === null || (Number.isInteger(p.grade) && p.grade >= 1 && p.grade <= 11))) err(p.id, "класс");
  if (![1, 2, 3].includes(p.difficulty)) err(p.id, "сложность");
  if (!checkProblem(p.answer, p.answer)) err(p.id, `ответ «${p.answer}» не принимается проверкой`);
  if ((p.text.match(/\$/g) || []).length % 2) err(p.id, "непарный $ в условии");
  if ((p.solution.match(/\$/g) || []).length % 2) err(p.id, "непарный $ в решении");
  lint(p.id, p.text); lint(p.id, p.solution);
}

// Независимый пересчёт: разбираем условие и решаем заново.
let rechecked = 0;
const tex = s => s.replace(/\\cdot/g, "*").replace(/\s+/g, "");
for (const p of problems) {
  const t = p.text, a = n(p.answer);
  let expect = null, m;
  if ((m = /^Вычислите: \$(-?\d+) \+ (\d+) \\cdot (\d+)\$\.$/.exec(t))) expect = +m[1] + m[2] * m[3];
  else if ((m = /^Решите уравнение \$(-?\d+)x ([+-]) (\d+) = (-?\d+)\$\.$/.exec(t))) expect = (+m[4] - (m[2] === "+" ? +m[3] : -m[3])) / +m[1];
  else if ((m = /^Решите уравнение \$x\^2 ([+-]) ?(\d*)x ?([+-]) (\d+) = 0\$\. В ответ запишите больший корень\.$/.exec(t))) {
    const b = (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : +m[2]), c = (m[3] === "-" ? -1 : 1) * +m[4], D = b * b - 4 * c;
    expect = (-b + Math.sqrt(D)) / 2;
  }
  else if ((m = /^Катеты прямоугольного треугольника равны (\d+) и (\d+)\./.exec(t))) expect = Math.hypot(+m[1], +m[2]);
  else if ((m = /^Гипотенуза прямоугольного треугольника равна (\d+), один из катетов (\d+)\./.exec(t))) expect = Math.sqrt(m[1] ** 2 - m[2] ** 2);
  else if ((m = /^Найдите (\d+)% от числа (\d+)\.$/.exec(t))) expect = m[1] * m[2] / 100;
  else if ((m = /^Вычислите: \$\\frac\{(\d+)\}\{(\d+)\} \+ \\frac\{(\d+)\}\{(\d+)\}\$/.exec(t))) expect = m[1] / m[2] + m[3] / m[4];
  else if ((m = /^Вычислите: \$\\frac\{(\d+)\}\{(\d+)\} \\cdot \\frac\{(\d+)\}\{(\d+)\}\$/.exec(t))) expect = (m[1] * m[3]) / (m[2] * m[4]);
  else if ((m = /^Арифметическая прогрессия задана условиями \$a_1 = (-?\d+)\$, \$d = (-?\d+)\$\. Найдите \$a_\{(\d+)\}\$\.$/.exec(t))) expect = +m[1] + (m[3] - 1) * m[2];
  else if ((m = /^Геометрическая прогрессия задана условиями \$b_1 = (-?\d+)\$, \$q = (-?\d+)\$\. Найдите \$b_\{(\d+)\}\$\.$/.exec(t))) expect = m[1] * m[2] ** (m[3] - 1);
  else if ((m = /^Вычислите: \$\\log_\{(\d+)\} (\d+)\$\.$/.exec(t))) expect = Math.log(+m[2]) / Math.log(+m[1]);
  else if ((m = /^Два угла треугольника равны (\d+)° и (\d+)°/.exec(t))) expect = 180 - m[1] - m[2];
  else if ((m = /^Вычислите: \$\\sqrt\{(\d+)\} \+ \\sqrt\{(\d+)\}\$\.$/.exec(t))) expect = Math.sqrt(+m[1]) + Math.sqrt(+m[2]);
  else if ((m = /^Вычислите удобным способом: \$(\d+)\^2\$\.$/.exec(t))) expect = m[1] ** 2;
  else if ((m = /^Вычислите удобным способом: \$(\d+) \\cdot (\d+)\$\.$/.exec(t))) expect = m[1] * m[2];
  else if ((m = /^Решите систему \$\\begin\{cases\} x \+ y = (-?\d+) \\\\ x - y = (-?\d+) \\end\{cases\}\$\. В ответ запишите произведение \$xy\$\.$/.exec(t))) { const x = (+m[1] + +m[2]) / 2; expect = x * (m[1] - x); }
  else if ((m = /^Найдите наибольший общий делитель чисел (\d+) и (\d+)\.$/.exec(t))) { let x = +m[1], y = +m[2]; while (y) [x, y] = [y, x % y]; expect = x; }
  if (expect === null) continue;
  rechecked++;
  if (!(Math.abs(expect - a) < 1e-6)) err(p.id, `пересчёт дал ${expect}, а в базе ${p.answer} — «${t}»`);
}

for (const t of tests) {
  if (!strOk(t.title, 1, 200) || !strOk(t.topic, 0, 200) || !strOk(t.description, 0, 2000)) err(t.id, "длина поля теста");
  if (t.questions.length < 1 || t.questions.length > 30 || t.answers.length !== t.questions.length) err(t.id, "число вопросов/ответов");
  t.questions.forEach((q, i) => {
    const k = t.answers[i];
    if (!strOk(q.text, 1, 2000)) err(t.id, `вопрос ${i + 1}: текст`);
    if (q.type === "choice" && !(q.options.length >= 2 && q.options.length <= 6 && Number(k) >= 0 && Number(k) < q.options.length)) err(t.id, `вопрос ${i + 1}: варианты/ключ`);
    if (q.type === "number" && k.split(";").some(x => !Number.isFinite(n(x)))) err(t.id, `вопрос ${i + 1}: ключ «${k}» не число`);
    if (!isCorrect(q, k, q.type === "choice" ? k : k.split(";")[0])) err(t.id, `вопрос ${i + 1}: правильный ответ не засчитывается`);
    lint(`${t.id}#${i + 1}`, q.text);
  });
}

for (const m of materials) {
  if (!strOk(m.title, 1, 200) || !strOk(m.description, 0, 2000) || !strOk(m.topic, 0, 200)) err(m.id, "длина поля материала");
  if (m.url && !/^https?:\/\/./.test(m.url)) err(m.id, "ссылка");
  if (!["material", "video", "test", "worksheet"].includes(m.type)) err(m.id, "тип");
}

console.log(`Задач: ${problems.length}, из них ответ пересчитан независимо: ${rechecked}. Тестов: ${tests.length}. Материалов: ${materials.length}.`);
console.log(errors.length ? `Ошибок: ${errors.length}\n` + errors.join("\n") : "Ошибок нет");
process.exitCode = errors.length ? 1 : 0;
