// Генератор учебной базы: банк задач, тесты и материалы-шпаргалки для 5–11 классов.
// Ответы вычисляются кодом (а не пишутся вручную), решения — пошагово в LaTeX ($…$).
// Запуск: node content/build.mjs  →  content/content.json (затем content/upload.mjs).
// Банк задач детерминированный (ответы в нём открыты для самопроверки). Вопросы тестов — ОТДЕЛЬНЫЕ задачи,
// которых нет в банке, из секретного зерна (CONTENT_TEST_SEED или случайного): репозиторий публичный,
// поэтому ответы тестов нельзя выводить из кода. content.json в git не хранится.
import { writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";

/* ---------- Инструменты ---------- */

let seed = 20261018;
const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = arr => arr[Math.floor(rand() * arr.length)];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
// Число по-русски: десятичная запятая, без хвостовых нулей.
const num = x => { const r = Math.round(x * 1e6) / 1e6; return String(r).replace(".", ","); };
const tnum = x => num(x).replace(",", "{,}");
const pn = v => v < 0 ? `(${v})` : `${v}`;
const frac = (p, q) => { if (q < 0) { p = -p; q = -q; } const g = gcd(p, q) || 1; return [p / g, q / g]; };
const fracStr = (p, q) => { [p, q] = frac(p, q); return q === 1 ? String(p) : `${p}/${q}`; };
const fracTex = (p, q) => { [p, q] = frac(p, q); return q === 1 ? String(p) : `${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}`; };
const sgn = (n, first = false) => n < 0 ? `- ${-n}` : first ? `${n}` : `+ ${n}`;
const term = (k, v, first = false) => k === 0 ? "" : `${k < 0 ? (first ? "-" : "- ") : first ? "" : "+ "}${Math.abs(k) === 1 ? "" : Math.abs(k)}${v}`;

// add() только описывает тему; задачи создаёт generate() — для банка и, отдельно, для тестов.
const defs = [];
function add(topic, grade, difficulty, gen, count) { defs.push({ topic, grade, difficulty, gen, count }); }
function generate(seedValue, exclude, idPrefix) {
  seed = seedValue;
  const out = [];
  for (const d of defs) {
    const seen = new Set();
    for (let i = 0, guard = 0; i < d.count && guard < d.count * 30; guard++) {
      const p = d.gen(i);
      if (!p || seen.has(p.text) || exclude.has(p.text)) continue;
      seen.add(p.text);
      out.push({ id:`${idPrefix}${String(out.length + 1).padStart(3, "0")}`, topic:d.topic, grade:d.grade, difficulty:p.difficulty || d.difficulty, text:p.text, answer:String(p.answer), solution:p.solution || "" });
      i++;
    }
  }
  return out;
}

/* ---------- 5 класс ---------- */

add("Порядок действий", 5, 1, () => {
  const a = ri(12, 90), b = ri(2, 9), c = ri(2, 9);
  return { text:`Вычислите: $${a} + ${b} \\cdot ${c}$.`, answer:a + b * c, solution:`Сначала умножение: $${b} \\cdot ${c} = ${b * c}$. Затем сложение: $${a} + ${b * c} = ${a + b * c}$.` };
}, 4);
add("Порядок действий", 5, 2, () => {
  const c = ri(2, 9), q = ri(3, 12), a = ri(2, 20), b = c * q - a;
  if (b <= 0) return null;
  return { text:`Вычислите: $(${a} + ${b}) : ${c} - ${q - 1}$.`, answer:1, solution:`Скобки: $${a} + ${b} = ${a + b}$. Деление: $${a + b} : ${c} = ${q}$. Вычитание: $${q} - ${q - 1} = 1$.` };
}, 2);
add("Делимость", 5, 2, () => {
  const g = ri(2, 12), x = ri(2, 9), y = ri(2, 9);
  if (gcd(x, y) !== 1 || x === y) return null;
  const a = g * x, b = g * y;
  return { text:`Найдите наибольший общий делитель чисел ${a} и ${b}.`, answer:g, solution:`$${a} = ${g} \\cdot ${x}$, $${b} = ${g} \\cdot ${y}$, а числа ${x} и ${y} взаимно простые, поэтому НОД$(${a}, ${b}) = ${g}$.` };
}, 3);
add("Делимость", 5, 2, () => {
  const a = ri(4, 18), b = ri(4, 18);
  if (a === b || a % b === 0 || b % a === 0) return null;
  return { text:`Найдите наименьшее общее кратное чисел ${a} и ${b}.`, answer:lcm(a, b), solution:`НОК$(a, b) = \\frac{a \\cdot b}{\\text{НОД}(a, b)} = \\frac{${a} \\cdot ${b}}{${gcd(a, b)}} = ${lcm(a, b)}$.` };
}, 3);

/* ---------- 6 класс ---------- */

add("Обыкновенные дроби", 6, 1, () => {
  const b = ri(2, 9), d = ri(2, 9), a = ri(1, b - 1), c = ri(1, d - 1);
  if (b === d || gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;
  const [p, q] = frac(a * d + c * b, b * d), L = lcm(b, d), top = a * L / b + c * L / d;
  return { text:`Вычислите: $\\frac{${a}}{${b}} + \\frac{${c}}{${d}}$. Ответ запишите обыкновенной дробью.`, answer:fracStr(p, q),
    solution:`Общий знаменатель ${L}: $\\frac{${a * L / b}}{${L}} + \\frac{${c * L / d}}{${L}} = \\frac{${top}}{${L}}${top === p && L === q ? "" : " = " + fracTex(p, q)}$.` };
}, 4);
add("Обыкновенные дроби", 6, 2, () => {
  const b = ri(2, 9), d = ri(2, 9), a = ri(1, 8), c = ri(1, 8);
  if (a >= b || c >= d || gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;
  return { text:`Вычислите: $\\frac{${a}}{${b}} \\cdot \\frac{${c}}{${d}}$. Ответ запишите обыкновенной дробью.`, answer:fracStr(a * c, b * d),
    solution:`$\\frac{${a} \\cdot ${c}}{${b} \\cdot ${d}} = \\frac{${a * c}}{${b * d}} = ${fracTex(a * c, b * d)}$.` };
}, 3);
add("Десятичные дроби", 6, 1, () => {
  const a = ri(11, 99) / 10, b = ri(2, 9) / 10 + ri(1, 3);
  const r = Math.round(a * b * 1000) / 1000;
  return { text:`Вычислите: $${tnum(a)} \\cdot ${tnum(b)}$.`, answer:num(r), solution:`Умножаем как целые: $${Math.round(a * 10)} \\cdot ${Math.round(b * 10)} = ${Math.round(a * 10) * Math.round(b * 10)}$, затем отделяем два знака после запятой: ${num(r)}.` };
}, 3);
add("Десятичные дроби", 6, 2, () => {
  const b = pick([2, 4, 5, 8, 25]), r = ri(11, 99) / 10, a = Math.round(r * b * 100) / 100;
  return { text:`Вычислите: $${tnum(a)} : ${b}$.`, answer:num(r), solution:`$${tnum(a)} : ${b} = ${tnum(r)}$, проверка: $${tnum(r)} \\cdot ${b} = ${tnum(a)}$.` };
}, 3);
add("Проценты", 6, 1, () => {
  const p = pick([10, 15, 20, 25, 30, 40, 50, 75]), n = ri(2, 20) * 20;
  return { text:`Найдите ${p}% от числа ${n}.`, answer:num(n * p / 100), solution:`${p}% — это $\\frac{${p}}{100}$. $${n} \\cdot \\frac{${p}}{100} = ${tnum(n * p / 100)}$.` };
}, 3);
add("Проценты", 6, 2, () => {
  const p = pick([10, 20, 25, 30, 40]), n = ri(5, 40) * 100, up = rand() < 0.5;
  const r = up ? n * (1 + p / 100) : n * (1 - p / 100);
  return { text:`Товар стоил ${n} ₽. Цену ${up ? "повысили" : "снизили"} на ${p}%. Сколько стоит товар теперь?`, answer:num(r),
    solution:`${up ? "Новая цена — это" : "Осталось"} $${up ? 100 + p : 100 - p}\\%$ от прежней: $${n} \\cdot ${tnum(up ? 1 + p / 100 : 1 - p / 100)} = ${tnum(r)}$ ₽.` };
}, 3);
add("Пропорции", 6, 2, () => {
  const a = ri(2, 12), b = ri(2, 12), k = ri(2, 6), c = b * k;
  if (a === b) return null;
  return { text:`Найдите $x$ из пропорции $\\frac{${a}}{${b}} = \\frac{x}{${c}}$.`, answer:a * k, solution:`По основному свойству пропорции $x = \\frac{${a} \\cdot ${c}}{${b}} = ${a * k}$.` };
}, 3);
add("Положительные и отрицательные числа", 6, 1, () => {
  const a = ri(-30, 30), b = ri(-30, 30), c = ri(2, 6) * (rand() < 0.5 ? -1 : 1);
  if (!a || !b) return null;
  const r = a - b * c;
  return { text:`Вычислите: $${a} - ${pn(b)} \\cdot ${pn(c)}$.`, answer:r, solution:`$${pn(b)} \\cdot ${pn(c)} = ${b * c}$, затем $${a} - ${pn(b * c)} = ${r}$.` };
}, 3);

/* ---------- 7 класс ---------- */

add("Линейные уравнения", 7, 1, () => {
  const a = ri(2, 9) * (rand() < 0.3 ? -1 : 1), x = ri(-9, 12), b = ri(-20, 20), c = a * x + b;
  if (!b) return null;
  return { text:`Решите уравнение $${a}x ${sgn(b)} = ${c}$.`, answer:x, solution:`$${a}x = ${c} ${sgn(-b)} = ${c - b}$, $x = ${c - b} : ${pn(a)} = ${x}$.` };
}, 4);
add("Линейные уравнения", 7, 2, () => {
  const a = ri(2, 6), b = ri(-8, 8), x = ri(-6, 10), c = ri(1, 9), d = a * (x - b) - c * x;
  if (a === c || !b) return null;
  return { text:`Решите уравнение $${a}(x ${sgn(-b)}) = ${c}x ${sgn(d)}$.`, answer:x,
    solution:`Раскрываем скобки: $${a}x ${sgn(-a * b)} = ${c}x ${sgn(d)}$. Переносим: $${term(a - c, "x", true)} = ${d + a * b}$, $x = ${x}$.` };
}, 3);
add("Степени", 7, 1, () => {
  const a = pick([2, 3, 5, 10]), m = ri(1, 3), n = ri(1, 3);
  return { text:`Вычислите: $${a}^{${m}} \\cdot ${a}^{${n}}$.`, answer:a ** (m + n), solution:`$${a}^{${m}} \\cdot ${a}^{${n}} = ${a}^{${m + n}} = ${a ** (m + n)}$.` };
}, 3);
add("Степени", 7, 2, () => {
  const a = pick([2, 3]), m = ri(5, 9), n = ri(2, m - 1);
  return { text:`Вычислите: $\\frac{${a}^{${m}}}{${a}^{${n}}}$.`, answer:a ** (m - n), solution:`При делении степеней показатели вычитаются: $${a}^{${m} - ${n}} = ${a}^{${m - n}} = ${a ** (m - n)}$.` };
}, 3);
add("Формулы сокращённого умножения", 7, 2, () => {
  const base = pick([20, 30, 40, 50, 60, 70, 80, 90]), d = ri(1, 3), plus = rand() < 0.5, n = plus ? base + d : base - d;
  return { text:`Вычислите удобным способом: $${n}^2$.`, answer:n * n,
    solution:`$(${base} ${plus ? "+" : "-"} ${d})^2 = ${base}^2 ${plus ? "+" : "-"} 2 \\cdot ${base} \\cdot ${d} + ${d}^2 = ${base * base} ${plus ? "+" : "-"} ${2 * base * d} + ${d * d} = ${n * n}$.` };
}, 3);
add("Формулы сокращённого умножения", 7, 2, () => {
  const base = pick([30, 40, 50, 60, 70, 80, 100]), d = ri(1, 5);
  return { text:`Вычислите удобным способом: $${base + d} \\cdot ${base - d}$.`, answer:base * base - d * d,
    solution:`$(${base} + ${d})(${base} - ${d}) = ${base}^2 - ${d}^2 = ${base * base} - ${d * d} = ${base * base - d * d}$.` };
}, 3);
add("Линейная функция", 7, 1, () => {
  const k = ri(-5, 5), b = ri(-10, 10), x = ri(-6, 6);
  if (!k || !b) return null;
  return { text:`Функция задана формулой $y = ${term(k, "x", true)} ${sgn(b)}$. Найдите $y$ при $x = ${x}$.`, answer:k * x + b, solution:`$y = ${k} \\cdot ${pn(x)} ${sgn(b)} = ${k * x + b}$.` };
}, 3);
add("Линейная функция", 7, 2, () => {
  const k = ri(2, 6) * (rand() < 0.5 ? -1 : 1), b = ri(-10, 10), x = ri(-6, 8), y = k * x + b;
  if (!b) return null;
  return { text:`При каком $x$ функция $y = ${term(k, "x", true)} ${sgn(b)}$ принимает значение ${y}?`, answer:x, solution:`$${k}x ${sgn(b)} = ${y}$, $${k}x = ${y - b}$, $x = ${x}$.` };
}, 3);
add("Углы треугольника", 7, 1, () => {
  const a = ri(25, 90), b = ri(20, 150 - a);
  return { text:`Два угла треугольника равны ${a}° и ${b}°. Найдите третий угол (в градусах).`, answer:180 - a - b, solution:`Сумма углов треугольника равна 180°: $180 - ${a} - ${b} = ${180 - a - b}$°.` };
}, 3);
add("Углы треугольника", 7, 2, () => {
  const top = ri(20, 140); if (top % 2) return null;
  return { text:`Угол при вершине равнобедренного треугольника равен ${top}°. Найдите угол при основании (в градусах).`, answer:(180 - top) / 2,
    solution:`Углы при основании равны: $(180 - ${top}) : 2 = ${(180 - top) / 2}$°.` };
}, 3);

/* ---------- 8 класс ---------- */

add("Квадратные корни", 8, 1, () => {
  const a = ri(2, 15), b = ri(2, 9);
  return { text:`Вычислите: $\\sqrt{${a * a}} + \\sqrt{${b * b}}$.`, answer:a + b, solution:`$\\sqrt{${a * a}} = ${a}$, $\\sqrt{${b * b}} = ${b}$, сумма $${a + b}$.` };
}, 3);
add("Квадратные корни", 8, 2, () => {
  const k = ri(2, 6), m = pick([2, 3, 5]), a = k * k * m;
  return { text:`Вычислите: $\\sqrt{${a}} \\cdot \\sqrt{${m}}$.`, answer:k * m, solution:`$\\sqrt{${a} \\cdot ${m}} = \\sqrt{${a * m}} = ${k * m}$.` };
}, 3);
add("Квадратные уравнения", 8, 2, () => {
  const p = ri(-9, 9), q = ri(-9, 9); if (p === q) return null;
  const b = -(p + q), c = p * q, D = b * b - 4 * c;
  return { text:`Решите уравнение $x^2 ${term(b, "x")} ${c ? sgn(c) : ""} = 0$. В ответ запишите больший корень.`.replace("  ", " "), answer:Math.max(p, q),
    solution:`$D = ${pn(b)}^2 - 4 \\cdot ${pn(c)} = ${D}$, $\\sqrt{D} = ${Math.sqrt(D)}$. $x = \\frac{${-b} \\pm ${Math.sqrt(D)}}{2}$, корни ${Math.min(p, q)} и ${Math.max(p, q)}. Больший — ${Math.max(p, q)}.` };
}, 5);
add("Квадратные уравнения", 8, 3, () => {
  const a = ri(2, 4), p = ri(-5, 5), q = ri(-5, 5); if (p === q) return null;
  const b = -a * (p + q), c = a * p * q;
  return { text:`Решите уравнение $${a}x^2 ${term(b, "x")} ${c ? sgn(c) : ""} = 0$. В ответ запишите сумму корней.`.replace("  ", " "), answer:p + q,
    solution:`Корни ${p} и ${q} (проверьте подстановкой). По теореме Виета сумма корней $-\\frac{b}{a} = -\\frac{${b}}{${a}} = ${p + q}$.` };
}, 3);
add("Теорема Виета", 8, 2, () => {
  const p = ri(-8, 8), q = ri(-8, 8); if (!p || !q) return null;
  const b = -(p + q), c = p * q, ask = rand() < 0.5;
  return { text:`Не решая уравнение $x^2 ${term(b, "x")} ${sgn(c)} = 0$, найдите ${ask ? "сумму" : "произведение"} его корней.`.replace("  ", " "), answer:ask ? p + q : c,
    solution:`По теореме Виета $x_1 + x_2 = ${-b}$, $x_1 \\cdot x_2 = ${c}$.` };
}, 4);
add("Теорема Пифагора", 8, 1, () => {
  const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]), k = ri(1, 4);
  return { text:`Катеты прямоугольного треугольника равны ${a * k} и ${b * k}. Найдите гипотенузу.`, answer:c * k,
    solution:`$c = \\sqrt{${a * k}^2 + ${b * k}^2} = \\sqrt{${(a * k) ** 2 + (b * k) ** 2}} = ${c * k}$.` };
}, 4);
add("Теорема Пифагора", 8, 2, () => {
  const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [9, 12, 15], [6, 8, 10]]), k = ri(1, 3);
  return { text:`Гипотенуза прямоугольного треугольника равна ${c * k}, один из катетов ${a * k}. Найдите другой катет.`, answer:b * k,
    solution:`$b = \\sqrt{${c * k}^2 - ${a * k}^2} = \\sqrt{${(c * k) ** 2 - (a * k) ** 2}} = ${b * k}$.` };
}, 3);
add("Площади фигур", 8, 1, () => {
  const f = pick(["tri", "par", "trap"]), a = ri(4, 20), b = ri(3, 18), h = ri(2, 15);
  if (f === "tri") return (a * h) % 2 ? null : { text:`Основание треугольника равно ${a}, высота, проведённая к нему, — ${h}. Найдите площадь треугольника.`, answer:a * h / 2, solution:`$S = \\frac{1}{2} \\cdot ${a} \\cdot ${h} = ${a * h / 2}$.` };
  if (f === "par") return { text:`Сторона параллелограмма равна ${a}, высота, проведённая к ней, — ${h}. Найдите площадь параллелограмма.`, answer:a * h, solution:`$S = a \\cdot h = ${a} \\cdot ${h} = ${a * h}$.` };
  return ((a + b) * h) % 2 ? null : { text:`Основания трапеции равны ${a} и ${b}, высота ${h}. Найдите площадь трапеции.`, answer:(a + b) * h / 2, solution:`$S = \\frac{${a} + ${b}}{2} \\cdot ${h} = ${(a + b) * h / 2}$.` };
}, 6);
add("Линейные неравенства", 8, 2, () => {
  const a = ri(2, 7), x0 = ri(-6, 8), b = ri(-15, 15), c = a * x0 + b;
  return { text:`Решите неравенство $${a}x ${sgn(b)} > ${c}$. В ответ запишите наименьшее целое решение.`, answer:x0 + 1,
    solution:`$${a}x > ${c - b}$, $x > ${x0}$. Наименьшее целое число, большее ${x0}, — это ${x0 + 1}.` };
}, 4);

/* ---------- 9 класс ---------- */

add("Системы уравнений", 9, 2, () => {
  const x = ri(-6, 9), y = ri(-6, 9), s = x + y, d = x - y;
  return { text:`Решите систему $\\begin{cases} x + y = ${s} \\\\ x - y = ${d} \\end{cases}$. В ответ запишите произведение $xy$.`, answer:x * y,
    solution:`Складываем уравнения: $2x = ${s + d}$, $x = ${x}$. Тогда $y = ${s} - ${pn(x)} = ${y}$, $xy = ${x * y}$.` };
}, 4);
add("Системы уравнений", 9, 3, () => {
  const x = ri(-5, 6), y = ri(-5, 6), a = ri(2, 4), b = ri(2, 5);
  return { text:`Решите систему $\\begin{cases} ${a}x + y = ${a * x + y} \\\\ x + ${b}y = ${x + b * y} \\end{cases}$. В ответ запишите $x + y$.`, answer:x + y,
    solution:`Из первого: $y = ${a * x + y} - ${a}x$. Подставляем во второе и находим $x = ${x}$, $y = ${y}$. Значит, $x + y = ${x + y}$.` };
}, 3);
add("Арифметическая прогрессия", 9, 1, () => {
  const a1 = ri(-10, 20), d = ri(-5, 7), n = ri(6, 25); if (!d) return null;
  return { text:`Арифметическая прогрессия задана условиями $a_1 = ${a1}$, $d = ${d}$. Найдите $a_{${n}}$.`, answer:a1 + (n - 1) * d,
    solution:`$a_n = a_1 + (n - 1)d = ${a1} + ${n - 1} \\cdot ${pn(d)} = ${a1 + (n - 1) * d}$.` };
}, 3);
add("Арифметическая прогрессия", 9, 2, () => {
  const a1 = ri(-5, 15), d = ri(1, 6), n = ri(5, 20), an = a1 + (n - 1) * d;
  return { text:`Найдите сумму первых ${n} членов арифметической прогрессии, если $a_1 = ${a1}$, $d = ${d}$.`, answer:(a1 + an) * n / 2,
    solution:`$a_{${n}} = ${a1} + ${n - 1} \\cdot ${d} = ${an}$. $S_{${n}} = \\frac{a_1 + a_{${n}}}{2} \\cdot ${n} = \\frac{${a1} + ${an}}{2} \\cdot ${n} = ${(a1 + an) * n / 2}$.` };
}, 3);
add("Геометрическая прогрессия", 9, 2, () => {
  const b1 = pick([1, 2, 3, 5, -2]), q = pick([2, 3, -2]), n = ri(3, 6);
  return { text:`Геометрическая прогрессия задана условиями $b_1 = ${b1}$, $q = ${q}$. Найдите $b_{${n}}$.`, answer:b1 * q ** (n - 1),
    solution:`$b_n = b_1 \\cdot q^{n-1} = ${b1} \\cdot ${q < 0 ? `(${q})` : q}^{${n - 1}} = ${b1 * q ** (n - 1)}$.` };
}, 4);
add("Вероятность", 9, 1, () => {
  const total = pick([10, 20, 25, 40, 50]), good = ri(1, total - 1), kind = pick([0, 1, 2]);
  const text = [`На тарелке ${total} пирожков, из них ${good} с капустой. Какова вероятность, что наугад взятый пирожок окажется с капустой?`,
    `В сборнике ${total} билетов, из них ${good} по геометрии. Какова вероятность, что школьнику достанется билет по геометрии?`,
    `В коробке ${total} шаров, из них ${good} ${good % 10 === 1 && good % 100 !== 11 ? "красный" : "красных"}. Какова вероятность наугад достать красный шар?`][kind];
  return { text, answer:num(good / total), solution:`$P = \\frac{${good}}{${total}} = ${tnum(good / total)}$.` };
}, 4);
add("Вероятность", 9, 2, () => ({ text:"Игральную кость бросают один раз. Найдите вероятность того, что выпадет число очков больше 4.", answer:"1/3", solution:"Подходят 5 и 6 — два исхода из шести: $P = \\frac{2}{6} = \\frac{1}{3}$." }), 1);
add("Вероятность", 9, 3, () => ({ text:"Монету бросают дважды. Найдите вероятность того, что орёл выпадет ровно один раз.", answer:"0,5", solution:"Исходы: ОО, ОР, РО, РР. Подходят ОР и РО: $P = \\frac{2}{4} = 0{,}5$." }), 1);
add("Окружность и круг", 9, 1, () => {
  const r = ri(2, 15), what = rand() < 0.5;
  return { text:`Радиус круга равен ${r}. Найдите ${what ? "длину окружности" : "площадь круга"}. В ответ запишите значение, делённое на $\\pi$.`, answer:what ? 2 * r : r * r,
    solution:what ? `$C = 2\\pi r = ${2 * r}\\pi$, ответ ${2 * r}.` : `$S = \\pi r^2 = ${r * r}\\pi$, ответ ${r * r}.` };
}, 4);
add("Квадратичная функция", 9, 2, () => {
  const a = ri(1, 3) * (rand() < 0.3 ? -1 : 1), x0 = ri(-5, 5), c = ri(-10, 10), b = -2 * a * x0;
  if (!c || !x0) return null;
  return { text:`Найдите абсциссу вершины параболы $y = ${a === 1 ? "" : a === -1 ? "-" : a}x^2 ${term(b, "x")} ${sgn(c)}$.`.replace("  ", " "), answer:x0,
    solution:`$x_0 = -\\frac{b}{2a} = -\\frac{${b}}{2 \\cdot ${a}} = ${x0}$.` };
}, 4);

/* ---------- 10–11 класс ---------- */

const TRIG = [["\\sin 30^\\circ", "0,5"], ["\\cos 60^\\circ", "0,5"], ["\\operatorname{tg} 45^\\circ", "1"], ["\\sin 90^\\circ", "1"], ["\\cos 0^\\circ", "1"], ["\\cos 180^\\circ", "-1"], ["\\sin 0^\\circ", "0"], ["\\cos 90^\\circ", "0"], ["\\sin 150^\\circ", "0,5"], ["\\cos 120^\\circ", "-0,5"]];
add("Тригонометрия", 10, 1, () => {
  const [a, va] = pick(TRIG), [b, vb] = pick(TRIG), k = ri(2, 4);
  if (vb === "0" || a === b) return null;
  const r = k * Number(va.replace(",", ".")) + Number(vb.replace(",", "."));
  return { text:`Вычислите: $${k}${a} + ${b}$.`, answer:num(r), solution:`$${a} = ${va.replace(",", "{,}")}$, $${b} = ${vb.replace(",", "{,}")}$. $${k} \\cdot ${va.startsWith("-") ? `(${va.replace(",", "{,}")})` : va.replace(",", "{,}")} +${vb.startsWith("-") ? `(${vb.replace(",", "{,}")})` : vb.replace(",", "{,}")} = ${num(r).replace(",", "{,}")}$.` };
}, 4);
add("Тригонометрия", 10, 2, () => {
  const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17]]), sinGiven = rand() < 0.5;
  return { text:`Известно, что $${sinGiven ? "\\sin" : "\\cos"} \\alpha = \\frac{${a}}{${c}}$ и угол $\\alpha$ острый. Найдите $${sinGiven ? "\\cos" : "\\sin"} \\alpha$.`, answer:fracStr(b, c),
    solution:`$${sinGiven ? "\\cos" : "\\sin"}^2 \\alpha = 1 - \\left(\\frac{${a}}{${c}}\\right)^2 = \\frac{${c * c - a * a}}{${c * c}}$. Угол острый, значит значение положительное: $\\frac{${b}}{${c}}$.` };
}, 4);
add("Логарифмы", 10, 1, () => {
  const b = pick([2, 3, 5, 10]), k = ri(1, b === 2 ? 7 : 4);
  return { text:`Вычислите: $\\log_{${b}} ${b ** k}$.`, answer:k, solution:`$${b ** k} = ${b}^{${k}}$, поэтому $\\log_{${b}} ${b ** k} = ${k}$.` };
}, 4);
add("Логарифмы", 10, 2, () => {
  const b = pick([2, 3]), m = ri(1, 4), n = ri(1, 4);
  return { text:`Вычислите: $\\log_{${b}} ${b ** m} + \\log_{${b}} ${b ** n}$.`, answer:m + n, solution:`$\\log_{${b}} ${b ** m} = ${m}$, $\\log_{${b}} ${b ** n} = ${n}$, сумма ${m + n}. Или: $\\log_{${b}} (${b ** m} \\cdot ${b ** n}) = \\log_{${b}} ${b ** (m + n)} = ${m + n}$.` };
}, 3);
add("Логарифмы", 10, 3, () => {
  const b = pick([2, 3, 5]), k = ri(2, 4), shift = ri(-5, 5);
  if (!shift) return null;
  return { text:`Решите уравнение $\\log_{${b}} (x ${sgn(shift)}) = ${k}$.`, answer:b ** k - shift, solution:`$x ${sgn(shift)} = ${b}^{${k}} = ${b ** k}$, $x = ${b ** k - shift}$.` };
}, 3);
add("Показательные уравнения", 10, 2, () => {
  const b = pick([2, 3, 5]), k = ri(1, 5), s = ri(-3, 3);
  if (!s) return null;
  return { text:`Решите уравнение $${b}^{x ${sgn(s)}} = ${b ** k}$.`, answer:k - s, solution:`$${b ** k} = ${b}^{${k}}$, поэтому $x ${sgn(s)} = ${k}$, $x = ${k - s}$.` };
}, 4);
add("Производная", 11, 2, () => {
  const a = ri(1, 3), b = ri(-5, 5), c = ri(-6, 6), x0 = ri(-3, 3);
  if (!b || !c || !x0) return null;
  const d = 3 * a * x0 * x0 + 2 * b * x0 + c;
  return { text:`Найдите значение производной функции $f(x) = ${a === 1 ? "" : a}x^3 ${term(b, "x^2")} ${term(c, "x")} + 1$ в точке $x_0 = ${x0}$.`.replace(/\s+\+ 1/, " + 1").replace("  ", " "), answer:d,
    solution:`$f'(x) = ${3 * a}x^2 ${term(2 * b, "x")} ${c ? sgn(c) : ""}$. $f'(${x0}) = ${3 * a} \\cdot ${x0 * x0} ${sgn(2 * b * x0)} ${c ? sgn(c) : ""} = ${d}$.`.replace(/\s+/g, " ") };
}, 4);
add("Производная", 11, 3, () => {
  const a = ri(1, 3), x0 = ri(-4, 4), c = ri(-8, 8), b = -2 * a * x0;
  if (!c || !x0) return null;
  const ymin = a * x0 * x0 + b * x0 + c;
  return { text:`Найдите наименьшее значение функции $y = ${a === 1 ? "" : a}x^2 ${term(b, "x")} ${sgn(c)}$.`.replace("  ", " "), answer:ymin,
    solution:`$y' = ${2 * a}x ${b ? sgn(b) : ""} = 0$ при $x = ${x0}$. Это точка минимума, $y(${x0}) = ${ymin}$.` };
}, 3);
add("Первообразная и интеграл", 11, 3, () => {
  const a = ri(1, 4), k = ri(1, 3);
  return { text:`Вычислите: $\\int_0^{${a}} ${k === 1 ? "" : 3 * k}x^2 \\, dx$.`.replace("\\int_0^{" + a + "} x^2", `\\int_0^{${a}} 3x^2`), answer:k * a ** 3,
    solution:`Первообразная $${k === 1 ? "" : k}x^3$. $${k === 1 ? "" : k}\\cdot ${a}^3 - 0 = ${k * a ** 3}$.` };
}, 3);


/* ---------- 1–4 класс (дописаны в конец, чтобы номера задач 5–11 классов не менялись) ---------- */

// Склонение: plural(5, ["яблоко", "яблока", "яблок"]) → «яблок».
const plural3 = (n, forms) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? forms[2] : b === 1 ? forms[0] : b >= 2 && b <= 4 ? forms[1] : forms[2]; };
const KIDS = [["Маши", "Маша", "отдала", "нашла"], ["Пети", "Петя", "отдал", "нашёл"], ["Ани", "Аня", "отдала", "нашла"], ["Коли", "Коля", "отдал", "нашёл"], ["Оли", "Оля", "отдала", "нашла"], ["Миши", "Миша", "отдал", "нашёл"]];
const THINGS = [["яблоко", "яблока", "яблок"], ["конфета", "конфеты", "конфет"], ["карандаш", "карандаша", "карандашей"], ["марка", "марки", "марок"], ["наклейка", "наклейки", "наклеек"]];
const qty = (n, forms) => `${n} ${plural3(n, forms)}`;

add("Сложение и вычитание до 10", 1, 1, () => {
  const a = ri(1, 9), b = ri(1, 10 - a), plus = rand() < 0.5;
  return plus ? { text:`Сколько будет $${a} + ${b}$?`, answer:a + b, solution:`$${a} + ${b} = ${a + b}$. Можно досчитать от ${a} ещё ${b}.` }
    : { text:`Сколько будет $${a + b} - ${b}$?`, answer:a, solution:`$${a + b} - ${b} = ${a}$. Можно отсчитать от ${a + b} назад ${b}.` };
}, 6);
add("Состав числа", 1, 1, () => {
  const n = ri(4, 10), a = ri(1, n - 1);
  return { text:`Число ${n} — это ${a} и сколько ещё?`, answer:n - a, solution:`$${n} - ${a} = ${n - a}$, значит ${n} — это ${a} и ${n - a}.` };
}, 5);
add("Сложение и вычитание до 20", 1, 2, () => {
  const a = ri(6, 9), b = ri(11 - a, 9), plus = rand() < 0.5;
  return plus ? { text:`Сколько будет $${a} + ${b}$?`, answer:a + b, solution:`Дополним до 10: $${a} + ${10 - a} = 10$, остаётся ещё ${b - (10 - a)}: $10 + ${b - (10 - a)} = ${a + b}$.` }
    : { text:`Сколько будет $${a + b} - ${b}$?`, answer:a, solution:`Сначала вычтем ${a + b - 10}, получим 10, потом ещё ${b - (a + b - 10)}: $10 - ${b - (a + b - 10)} = ${a}$.` };
}, 6);
add("Задачи в одно действие", 1, 1, () => {
  const [gen, name, gave, found] = pick(KIDS), th = pick(THINGS), a = ri(4, 10), b = ri(1, a - 1), more = rand() < 0.5;
  return more ? { text:`У ${gen} было ${qty(a, th)}. ${name} ${found} ещё ${qty(b, th)}. Сколько ${th[2]} стало у ${gen}?`, answer:a + b, solution:`Стало больше, значит складываем: $${a} + ${b} = ${a + b}$.` }
    : { text:`У ${gen} было ${qty(a, th)}. ${name} ${gave} ${qty(b, th)} другу. Сколько ${th[2]} осталось?`, answer:a - b, solution:`Осталось меньше, значит вычитаем: $${a} - ${b} = ${a - b}$.` };
}, 6);
add("Сложение и вычитание до 100", 2, 1, () => {
  const a = ri(12, 79), b = ri(11, 99 - a), plus = rand() < 0.5;
  return plus ? { text:`Вычислите: $${a} + ${b}$.`, answer:a + b, solution:`Десятки: $${a - a % 10} + ${b - b % 10} = ${a - a % 10 + b - b % 10}$, единицы: $${a % 10} + ${b % 10} = ${a % 10 + b % 10}$. Вместе ${a + b}.` }
    : { text:`Вычислите: $${a + b} - ${b}$.`, answer:a, solution:`$${a + b} - ${b} = ${a}$. Проверка сложением: $${a} + ${b} = ${a + b}$.` };
}, 6);
add("Таблица умножения", 2, 1, () => {
  const a = ri(2, 9), b = ri(2, 9);
  return { text:`Сколько будет $${a} \\cdot ${b}$?`, answer:a * b, solution:`$${a} \\cdot ${b} = ${a * b}$ — это ${a} раз по ${b}.` };
}, 8);
add("Деление", 2, 2, () => {
  const b = ri(2, 9), q = ri(2, 9);
  return { text:`Сколько будет $${b * q} : ${b}$?`, answer:q, solution:`Ищем число, которое при умножении на ${b} даёт ${b * q}: $${b} \\cdot ${q} = ${b * q}$, значит $${b * q} : ${b} = ${q}$.` };
}, 6);
add("Единицы длины", 2, 2, () => {
  const kind = ri(0, 2);
  if (kind === 0) { const m = ri(1, 9); return { text:`Сколько сантиметров в ${m} ${plural3(m, ["метре", "метрах", "метрах"])}?`, answer:m * 100, solution:`1 м = 100 см, поэтому $${m} \\cdot 100 = ${m * 100}$ см.` }; }
  if (kind === 1) { const dm = ri(1, 9), cm = ri(1, 9); return { text:`Сколько сантиметров в ${dm} дм ${cm} см?`, answer:dm * 10 + cm, solution:`1 дм = 10 см: $${dm} \\cdot 10 + ${cm} = ${dm * 10 + cm}$ см.` }; }
  const cm = ri(2, 9) * 10; return { text:`Сколько дециметров в ${cm} см?`, answer:cm / 10, solution:`10 см = 1 дм, поэтому $${cm} : 10 = ${cm / 10}$ дм.` };
}, 5);
add("Периметр", 2, 2, () => {
  const sq = rand() < 0.4, a = ri(2, 15), b = ri(2, 15);
  if (!sq && a === b) return null;
  return sq ? { text:`Найдите периметр квадрата со стороной ${a} см (в сантиметрах).`, answer:4 * a, solution:`У квадрата 4 равные стороны: $${a} \\cdot 4 = ${4 * a}$ см.` }
    : { text:`Найдите периметр прямоугольника со сторонами ${a} см и ${b} см (в сантиметрах).`, answer:2 * (a + b), solution:`$P = (${a} + ${b}) \\cdot 2 = ${2 * (a + b)}$ см.` };
}, 5);
add("Внетабличное умножение и деление", 3, 2, () => {
  const mult = rand() < 0.5, b = ri(2, 9), a = ri(11, 49);
  if (mult) return { text:`Вычислите: $${a} \\cdot ${b}$.`, answer:a * b, solution:`$${a} \\cdot ${b} = ${a - a % 10} \\cdot ${b} + ${a % 10} \\cdot ${b} = ${(a - a % 10) * b} + ${(a % 10) * b} = ${a * b}$.` };
  const q = ri(11, 30);
  return { text:`Вычислите: $${b * q} : ${b}$.`, answer:q, solution:`Проверка умножением: $${q} \\cdot ${b} = ${b * q}$, значит $${b * q} : ${b} = ${q}$.` };
}, 6);
add("Деление с остатком", 3, 2, () => {
  const b = ri(3, 9), q = ri(2, 9), r = ri(1, b - 1), a = b * q + r;
  return { text:`Разделите ${a} на ${b} с остатком. Чему равен остаток?`, answer:r, solution:`$${b} \\cdot ${q} = ${b * q}$, $${a} - ${b * q} = ${r}$. Значит $${a} : ${b} = ${q}$ (ост. ${r}). Остаток меньше делителя: $${r} < ${b}$.` };
}, 5);
add("Порядок действий (начальная школа)", 3, 2, () => {
  const a = ri(10, 50), b = ri(2, 9), c = ri(2, 9), kind = rand() < 0.5;
  if (kind && a <= b * c) return null;   // отрицательных чисел в 3 классе ещё нет
  return kind ? { text:`Вычислите: $${a} - ${b} \\cdot ${c}$.`, answer:a - b * c, solution:`Сначала умножение: $${b} \\cdot ${c} = ${b * c}$, потом вычитание: $${a} - ${b * c} = ${a - b * c}$.` }
    : { text:`Вычислите: $(${a} + ${b}) - ${c} \\cdot 2$.`, answer:a + b - c * 2, solution:`Скобки: $${a} + ${b} = ${a + b}$. Умножение: $${c} \\cdot 2 = ${c * 2}$. Вычитание: $${a + b} - ${c * 2} = ${a + b - c * 2}$.` };
}, 5);
add("Площадь прямоугольника", 3, 1, () => {
  const a = ri(2, 12), b = ri(2, 12);
  return a === b ? { text:`Найдите площадь квадрата со стороной ${a} см (в квадратных сантиметрах).`, answer:a * a, solution:`$S = ${a} \\cdot ${a} = ${a * a}$ см².` }
    : { text:`Найдите площадь прямоугольника со сторонами ${a} см и ${b} см (в квадратных сантиметрах).`, answer:a * b, solution:`$S = ${a} \\cdot ${b} = ${a * b}$ см².` };
}, 5);
add("Время", 3, 2, () => {
  const kind = ri(0, 1);
  if (kind === 0) { const h = ri(1, 3), m = ri(1, 5) * 5; return { text:`Сколько минут в ${h} ч ${m} мин?`, answer:h * 60 + m, solution:`1 ч = 60 мин: $${h} \\cdot 60 + ${m} = ${h * 60 + m}$ мин.` }; }
  const start = ri(9, 18), endM = pick([10, 15, 20, 30, 40, 45]), film = pick(["Фильм", "Спектакль", "Концерт", "Мультфильм"]);
  return { text:`${film} начался в ${start} ч и закончился в ${start + 1} ч ${endM} мин. Сколько минут он длился?`, answer:60 + endM,
    solution:`С ${start} ч до ${start + 1} ч прошёл 1 час = 60 мин, и ещё ${endM} мин: $60 + ${endM} = ${60 + endM}$ мин.` };
}, 4);
add("Единицы массы", 3, 2, () => {
  const kg = ri(1, 9), g = ri(1, 9) * 100;
  return rand() < 0.5 ? { text:`Сколько граммов в ${kg} кг ${g} г?`, answer:kg * 1000 + g, solution:`1 кг = 1000 г: $${kg} \\cdot 1000 + ${g} = ${kg * 1000 + g}$ г.` }
    : { text:`Сколько граммов в ${kg} кг?`, answer:kg * 1000, solution:`$${kg} \\cdot 1000 = ${kg * 1000}$ г.` };
}, 4);
add("Многозначные числа", 4, 1, () => {
  const a = ri(1200, 8000), b = ri(150, 9999 - a), plus = rand() < 0.5;
  return plus ? { text:`Вычислите: $${a} + ${b}$.`, answer:a + b, solution:`Складываем столбиком по разрядам: $${a} + ${b} = ${a + b}$.` }
    : { text:`Вычислите: $${a + b} - ${b}$.`, answer:a, solution:`Вычитаем столбиком: $${a + b} - ${b} = ${a}$. Проверка: $${a} + ${b} = ${a + b}$.` };
}, 5);
add("Умножение и деление многозначных", 4, 2, () => {
  const b = ri(2, 9), q = ri(102, 999);
  return rand() < 0.5 ? { text:`Вычислите: $${q} \\cdot ${b}$.`, answer:q * b, solution:`Умножаем столбиком: $${q} \\cdot ${b} = ${q * b}$.` }
    : { text:`Вычислите: $${q * b} : ${b}$.`, answer:q, solution:`Делим уголком: $${q * b} : ${b} = ${q}$. Проверка: $${q} \\cdot ${b} = ${q * b}$.` };
}, 5);
add("Доли", 4, 2, () => {
  const den = pick([2, 3, 4, 5, 6, 8, 10]), num_ = ri(1, den - 1), whole = den * ri(2, 9);
  if (gcd(num_, den) !== 1) return null;
  return { text:`Найдите $\\frac{${num_}}{${den}}$ от числа ${whole}.`, answer:whole / den * num_, solution:`Одна доля: $${whole} : ${den} = ${whole / den}$. ${num_ === 1 ? "Это и есть ответ." : `${num_} доли: $${whole / den} \\cdot ${num_} = ${whole / den * num_}$.`}` };
}, 5);
add("Скорость, время, расстояние", 4, 2, () => {
  const v = ri(2, 20) * 5, t = ri(2, 6), kind = ri(0, 2);
  // Транспорт под скорость, чтобы задача была правдоподобной.
  const [who, moved, past] = v <= 20 ? ["Велосипедист", "ехал", "проехал"] : v <= 60 ? ["Автомобиль", "ехал", "проехал"] : ["Поезд", "шёл", "прошёл"];
  if (kind === 0) return { text:`${who} ${moved} ${t} ч со скоростью ${v} км/ч. Какое расстояние он ${past} (в километрах)?`, answer:v * t, solution:`$s = v \\cdot t = ${v} \\cdot ${t} = ${v * t}$ км.` };
  if (kind === 1) return { text:`${who} ${past} ${v * t} км за ${t} ч. С какой скоростью он ${moved} (в км/ч)?`, answer:v, solution:`$v = s : t = ${v * t} : ${t} = ${v}$ км/ч.` };
  return { text:`${who} ${past} ${v * t} км со скоростью ${v} км/ч. Сколько часов он был в пути?`, answer:t, solution:`$t = s : v = ${v * t} : ${v} = ${t}$ ч.` };
}, 6);
add("Простые уравнения", 4, 2, () => {
  const kind = ri(0, 2), x = ri(5, 90), a = ri(5, 60);
  if (kind === 0) return { text:`Решите уравнение $x + ${a} = ${x + a}$.`, answer:x, solution:`Неизвестное слагаемое: $x = ${x + a} - ${a} = ${x}$.` };
  if (kind === 1) return { text:`Решите уравнение $${x + a} - x = ${a}$.`, answer:x, solution:`Неизвестное вычитаемое: $x = ${x + a} - ${a} = ${x}$.` };
  const b = ri(2, 9), y = ri(2, 12);
  return { text:`Решите уравнение $x \\cdot ${b} = ${b * y}$.`, answer:y, solution:`Неизвестный множитель: $x = ${b * y} : ${b} = ${y}$.` };
}, 5);

/* ---------- Тесты ---------- */

// Вопросы на понимание (выбор и короткий ответ) — по классам.
const CONCEPTS = {
  1:[{ text:"Какое число стоит перед числом 10?", type:"choice", options:["8", "9", "11"], answer:"1" },
     { text:"Как называется фигура без углов: квадрат, круг или треугольник?", type:"text", options:[], answer:"круг" },
     { text:"Сколько углов у треугольника?", type:"number", options:[], answer:"3" }],
  2:[{ text:"Какое из чисел чётное?", type:"choice", options:["15", "27", "34", "41"], answer:"2" },
     { text:"Как называется результат сложения?", type:"text", options:[], answer:"сумма" },
     { text:"Сколько сантиметров в 1 метре?", type:"number", options:[], answer:"100" }],
  3:[{ text:"Чему равен периметр квадрата со стороной 5 см?", type:"choice", options:["10 см", "20 см", "25 см"], answer:"1" },
     { text:"Как называется результат деления?", type:"text", options:[], answer:"частное" },
     { text:"Сколько минут в 1 часе?", type:"number", options:[], answer:"60" }],
  4:[{ text:"Какая доля больше: $\\frac{1}{2}$, $\\frac{1}{3}$ или $\\frac{1}{4}$?", type:"choice", options:["$\\frac{1}{2}$", "$\\frac{1}{3}$", "$\\frac{1}{4}$"], answer:"0" },
     { text:"Как называется число, которое делят?", type:"text", options:[], answer:"делимое" },
     { text:"Сколько граммов в 1 килограмме?", type:"number", options:[], answer:"1000" }],
  5:[{ text:"Какое из чисел делится на 3?", type:"choice", options:["124", "231", "302", "415"], answer:"1" },
     { text:"Как называется результат умножения?", type:"text", options:[], answer:"произведение" },
     { text:"Сколько сантиметров в 3 метрах?", type:"number", options:[], answer:"300" }],
  6:[{ text:"Какая из дробей больше: $\\frac{3}{4}$, $\\frac{2}{3}$, $\\frac{5}{8}$?", type:"choice", options:["$\\frac{3}{4}$", "$\\frac{2}{3}$", "$\\frac{5}{8}$"], answer:"0" },
     { text:"Как называется верхнее число в записи дроби?", type:"text", options:[], answer:"числитель" },
     { text:"Запишите $\\frac{3}{5}$ десятичной дробью.", type:"number", options:[], answer:"0,6" }],
  7:[{ text:"Какое из выражений равно $(a + b)^2$?", type:"choice", options:["$a^2 + b^2$", "$a^2 + 2ab + b^2$", "$a^2 - 2ab + b^2$", "$2a + 2b$"], answer:"1" },
     { text:"Как называется график функции $y = kx + b$?", type:"text", options:[], answer:"прямая" },
     { text:"Чему равна сумма углов треугольника (в градусах)?", type:"number", options:[], answer:"180" }],
  8:[{ text:"Сколько корней имеет квадратное уравнение, если $D < 0$?", type:"choice", options:["Ни одного", "Один", "Два"], answer:"0" },
     { text:"Как называется сторона прямоугольного треугольника, лежащая против прямого угла?", type:"text", options:[], answer:"гипотенуза" },
     { text:"Чему равен $\\sqrt{0{,}49}$?", type:"number", options:[], answer:"0,7" }],
  9:[{ text:"Какая формула задаёт $n$-й член арифметической прогрессии?", type:"choice", options:["$a_n = a_1 q^{n-1}$", "$a_n = a_1 + (n-1)d$", "$a_n = \\frac{a_1 + a_n}{2} n$"], answer:"1" },
     { text:"Как называется график функции $y = x^2$?", type:"text", options:[], answer:"парабола" },
     { text:"Вероятность события равна 0,3. Чему равна вероятность противоположного события?", type:"number", options:[], answer:"0,7" }],
  10:[{ text:"Чему равно $\\sin^2 \\alpha + \\cos^2 \\alpha$?", type:"choice", options:["0", "1", "$\\operatorname{tg} \\alpha$", "2"], answer:"1" },
      { text:"Как называется показатель степени, в которую нужно возвести основание, чтобы получить число?", type:"text", options:[], answer:"логарифм" },
      { text:"Сколько градусов в $\\pi$ радианах?", type:"number", options:[], answer:"180" }],
  11:[{ text:"Чему равна производная функции $y = x^n$?", type:"choice", options:["$x^{n+1}$", "$nx^{n-1}$", "$\\frac{x^{n+1}}{n+1}$", "$nx^n$"], answer:"1" },
      { text:"Как называется функция $F$, для которой $F'(x) = f(x)$?", type:"text", options:[], answer:"первообразная" },
      { text:"Чему равна производная функции $y = 5x$?", type:"number", options:[], answer:"5" }]
};

const problems = generate(20261018, new Set(), "seed-p");
const testSeed = Number(process.env.CONTENT_TEST_SEED) || randomInt(1, 2 ** 31);
const testPool = generate(testSeed, new Set(problems.map(p => p.text)), "t");

const tests = [];
const byGrade = g => testPool.filter(p => p.grade === g);
for (const g of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
  const pool = byGrade(g), topics = [...new Set(pool.map(p => p.topic))];
  const halves = [topics.filter((_, i) => i % 2 === 0), topics.filter((_, i) => i % 2 === 1)];
  halves.forEach((part, n) => {
    if (!part.length) return;
    // Из каждой темы — по две задачи, которых нет в банке, плюс вопросы на понимание.
    const qs = [];
    part.forEach(t => pool.filter(p => p.topic === t).slice(0, 2).forEach(p => qs.push({ text:p.text, type:"number", options:[], answer:p.answer })));
    const fromBank = qs.filter(q => !/[a-zа-я]/i.test(q.answer.replace(/[\d,/;\-\s]/g, ""))).slice(0, 7);
    const concept = CONCEPTS[g].filter((_, i) => i % 2 === n || CONCEPTS[g].length < 3);
    const questions = [...fromBank, ...concept].slice(0, 10);
    tests.push({
      id:`seed-t${g}-${n + 1}`,
      title:`${g} класс: ${part.slice(0, 3).join(", ").toLowerCase()}`,
      topic:part.join(", "), grade:g, student:"",
      description:`${questions.length} вопросов по пройденным темам. Числа можно вводить как 0,5 или 1/2.`,
      date:"2026-10-18",
      questions:questions.map(q => ({ text:q.text, type:q.type, options:q.options })),
      answers:questions.map(q => q.answer)
    });
  });
}

/* ---------- Материалы ---------- */

const materials = [
  { grade:1, topic:"Счёт", type:"material", title:"Состав чисел до 10", url:"",
    description:"2 = 1 + 1\n3 = 1 + 2\n4 = 1 + 3 = 2 + 2\n5 = 1 + 4 = 2 + 3\n6 = 1 + 5 = 2 + 4 = 3 + 3\n7 = 1 + 6 = 2 + 5 = 3 + 4\n8 = 1 + 7 = 2 + 6 = 3 + 5 = 4 + 4\n9 = 1 + 8 = 2 + 7 = 3 + 6 = 4 + 5\n10 = 1 + 9 = 2 + 8 = 3 + 7 = 4 + 6 = 5 + 5" },
  { grade:2, topic:"Умножение", type:"material", title:"Таблица умножения", url:"",
    description:"На 2: 2, 4, 6, 8, 10, 12, 14, 16, 18\nНа 3: 3, 6, 9, 12, 15, 18, 21, 24, 27\nНа 4: 4, 8, 12, 16, 20, 24, 28, 32, 36\nНа 5: 5, 10, 15, 20, 25, 30, 35, 40, 45\nНа 6: 6, 12, 18, 24, 30, 36, 42, 48, 54\nНа 7: 7, 14, 21, 28, 35, 42, 49, 56, 63\nНа 8: 8, 16, 24, 32, 40, 48, 56, 64, 72\nНа 9: 9, 18, 27, 36, 45, 54, 63, 72, 81\nОт перестановки множителей произведение не меняется: $3 \\cdot 7 = 7 \\cdot 3$." },
  { grade:2, topic:"Действия", type:"material", title:"Как называются числа при действиях", url:"",
    description:"Слагаемое + слагаемое = сумма\nУменьшаемое − вычитаемое = разность\nМножитель · множитель = произведение\nДелимое : делитель = частное" },
  { grade:3, topic:"Величины", type:"material", title:"Единицы измерения", url:"",
    description:"Длина: 1 см = 10 мм, 1 дм = 10 см, 1 м = 100 см, 1 км = 1000 м\nМасса: 1 кг = 1000 г, 1 ц = 100 кг, 1 т = 1000 кг\nВремя: 1 мин = 60 с, 1 ч = 60 мин, 1 сут = 24 ч\nПериметр прямоугольника: $P = (a + b) \\cdot 2$, площадь: $S = a \\cdot b$" },
  { grade:3, topic:"Действия", type:"material", title:"Порядок действий", url:"",
    description:"1. Сначала — действия в скобках.\n2. Потом умножение и деление слева направо.\n3. Потом сложение и вычитание слева направо.\nПример: $20 - 3 \\cdot 4 = 20 - 12 = 8$." },
  { grade:4, topic:"Задачи", type:"material", title:"Скорость, время, расстояние", url:"",
    description:"Расстояние = скорость · время: $s = v \\cdot t$\nСкорость = расстояние : время: $v = s : t$\nВремя = расстояние : скорость: $t = s : v$" },
  { grade:6, topic:"Дроби", type:"material", title:"Шпаргалка: действия с дробями", url:"",
    description:"Сложение: $\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}$.\nУмножение: $\\frac{a}{b} \\cdot \\frac{c}{d} = \\frac{ac}{bd}$.\nДеление: $\\frac{a}{b} : \\frac{c}{d} = \\frac{a}{b} \\cdot \\frac{d}{c}$.\nСокращение — делим числитель и знаменатель на их НОД." },
  { grade:6, topic:"Проценты", type:"material", title:"Шпаргалка: проценты", url:"",
    description:"$1\\% = \\frac{1}{100}$. Найти $p\\%$ от числа $a$: $a \\cdot \\frac{p}{100}$.\nНайти число по его $p\\%$, равным $b$: $b : \\frac{p}{100}$.\nУвеличить на $p\\%$: умножить на $1 + \\frac{p}{100}$; уменьшить — на $1 - \\frac{p}{100}$." },
  { grade:7, topic:"Алгебра", type:"material", title:"Формулы сокращённого умножения", url:"",
    description:"$(a + b)^2 = a^2 + 2ab + b^2$\n$(a - b)^2 = a^2 - 2ab + b^2$\n$a^2 - b^2 = (a - b)(a + b)$\n$a^3 + b^3 = (a + b)(a^2 - ab + b^2)$\n$a^3 - b^3 = (a - b)(a^2 + ab + b^2)$" },
  { grade:7, topic:"Алгебра", type:"material", title:"Свойства степеней", url:"",
    description:"$a^m \\cdot a^n = a^{m+n}$, $\\frac{a^m}{a^n} = a^{m-n}$, $(a^m)^n = a^{mn}$, $(ab)^n = a^n b^n$, $a^0 = 1$, $a^{-n} = \\frac{1}{a^n}$." },
  { grade:8, topic:"Квадратные уравнения", type:"material", title:"Квадратные уравнения: формулы", url:"",
    description:"$ax^2 + bx + c = 0$, дискриминант $D = b^2 - 4ac$.\n$D > 0$ — два корня $x = \\frac{-b \\pm \\sqrt{D}}{2a}$; $D = 0$ — один корень $x = -\\frac{b}{2a}$; $D < 0$ — корней нет.\nТеорема Виета для $x^2 + px + q = 0$: $x_1 + x_2 = -p$, $x_1 x_2 = q$." },
  { grade:8, topic:"Геометрия", type:"material", title:"Площади фигур", url:"",
    description:"Треугольник: $S = \\frac{1}{2} a h$. Параллелограмм: $S = a h$. Трапеция: $S = \\frac{a + b}{2} h$.\nПрямоугольный треугольник: $S = \\frac{1}{2} ab$, теорема Пифагора $c^2 = a^2 + b^2$." },
  { grade:9, topic:"Прогрессии", type:"material", title:"Прогрессии: формулы", url:"",
    description:"Арифметическая: $a_n = a_1 + (n - 1)d$, $S_n = \\frac{a_1 + a_n}{2} n$.\nГеометрическая: $b_n = b_1 q^{n-1}$, $S_n = \\frac{b_1 (q^n - 1)}{q - 1}$ при $q \\ne 1$." },
  { grade:9, topic:"Геометрия", type:"material", title:"Окружность и круг", url:"",
    description:"Длина окружности $C = 2\\pi r$, площадь круга $S = \\pi r^2$.\nДлина дуги в $\\alpha^\\circ$: $l = \\frac{\\pi r \\alpha}{180}$." },
  { grade:10, topic:"Тригонометрия", type:"material", title:"Тригонометрия: главное", url:"",
    description:"$\\sin^2 \\alpha + \\cos^2 \\alpha = 1$, $\\operatorname{tg} \\alpha = \\frac{\\sin \\alpha}{\\cos \\alpha}$.\n$\\sin 30^\\circ = \\frac{1}{2}$, $\\sin 45^\\circ = \\frac{\\sqrt{2}}{2}$, $\\sin 60^\\circ = \\frac{\\sqrt{3}}{2}$.\n$\\sin 2\\alpha = 2 \\sin \\alpha \\cos \\alpha$, $\\cos 2\\alpha = \\cos^2 \\alpha - \\sin^2 \\alpha$." },
  { grade:10, topic:"Логарифмы", type:"material", title:"Свойства логарифмов", url:"",
    description:"$\\log_a b = c \\iff a^c = b$ ($a > 0$, $a \\ne 1$, $b > 0$).\n$\\log_a (xy) = \\log_a x + \\log_a y$, $\\log_a \\frac{x}{y} = \\log_a x - \\log_a y$, $\\log_a x^k = k \\log_a x$.\nПереход к новому основанию: $\\log_a b = \\frac{\\log_c b}{\\log_c a}$." },
  { grade:11, topic:"Производная", type:"material", title:"Таблица производных", url:"",
    description:"$(C)' = 0$, $(x^n)' = n x^{n-1}$, $(\\sqrt{x})' = \\frac{1}{2\\sqrt{x}}$, $(e^x)' = e^x$, $(\\ln x)' = \\frac{1}{x}$, $(\\sin x)' = \\cos x$, $(\\cos x)' = -\\sin x$.\n$(uv)' = u'v + uv'$, $\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}$." }
];
// Внешние бесплатные ресурсы — ссылки проверяются в upload.mjs перед загрузкой.
const LINKS = [
  { grade:null, topic:"ОГЭ", type:"test", title:"Решу ОГЭ: математика", url:"https://oge.sdamgia.ru/", description:"Тренировочные варианты ОГЭ с ответами и решениями." },
  { grade:null, topic:"ЕГЭ", type:"test", title:"Решу ЕГЭ: профильная математика", url:"https://math-ege.sdamgia.ru/", description:"Задания профильного ЕГЭ по номерам и полные варианты." },
  { grade:null, topic:"ЕГЭ", type:"test", title:"Решу ЕГЭ: базовая математика", url:"https://mathb-ege.sdamgia.ru/", description:"Задания базового ЕГЭ с решениями." },
  { grade:null, topic:"ОГЭ", type:"material", title:"ФИПИ: открытый банк заданий ОГЭ", url:"https://oge.fipi.ru/bank/", description:"Официальный банк заданий от разработчиков экзамена." },
  { grade:null, topic:"ЕГЭ", type:"material", title:"ФИПИ: открытый банк заданий ЕГЭ", url:"https://ege.fipi.ru/bank/", description:"Официальный банк заданий ЕГЭ." },
  { grade:null, topic:"Уроки", type:"video", title:"Российская электронная школа: математика", url:"https://resh.edu.ru/subject/12/", description:"Видеоуроки и упражнения по школьной программе." },
  { grade:null, topic:"Графики", type:"material", title:"Desmos: построение графиков", url:"https://www.desmos.com/calculator?lang=ru", description:"Онлайн-калькулятор для построения графиков функций." },
  { grade:8, topic:"Справка", type:"material", title:"Квадратное уравнение — Википедия", url:"https://ru.wikipedia.org/wiki/Квадратное_уравнение", description:"Подробная статья с выводом формулы корней." },
  { grade:8, topic:"Справка", type:"material", title:"Теорема Пифагора — Википедия", url:"https://ru.wikipedia.org/wiki/Теорема_Пифагора", description:"История и доказательства теоремы." },
  { grade:11, topic:"Справка", type:"material", title:"Производная функции — Википедия", url:"https://ru.wikipedia.org/wiki/Производная_функции", description:"Определение, смысл и правила вычисления." }
];
// В шпаргалках дроби крупные (\dfrac) — это справочный текст, важна читаемость.
const allMaterials = [...materials, ...LINKS].map((m, i) => Object.assign({ id:`seed-m${String(i + 1).padStart(2, "0")}` }, m, { description:m.description.replace(/\\frac/g, "\\dfrac") }));

writeFileSync(new URL("./content.json", import.meta.url), JSON.stringify({ problems, tests, materials:allMaterials }, null, 2));
const grades = {};
problems.forEach(p => { grades[p.grade] = (grades[p.grade] || 0) + 1; });
console.log(`Задач: ${problems.length} (по классам: ${Object.entries(grades).map(([g, n]) => g + "кл " + n).join(", ")})`);
console.log(`Тем: ${new Set(problems.map(p => p.topic)).size}, тестов: ${tests.length} (вопросов ${tests.reduce((n, t) => n + t.questions.length, 0)}), материалов: ${allMaterials.length}`);
