// Проверка ответов для тестов и банка задач. Без зависимостей — используется и в auth.js, и на страницах.
// Числа принимаются в любом привычном виде: 0,5 · 0.5 · 1/2 · −3. Несколько допустимых ответов — через «;».

export const QUESTION_TYPES = { choice:"Выбор варианта", number:"Число", text:"Короткий ответ" };

// Шкала оценивания тренировок и тестов (та же проверяется в firestore.rules → gradeMatches).
export const GRADE_SCALE = [[90, 5], [75, 4], [50, 3], [0, 2]];
export const SCALE_TEXT = "90% и больше — «5», от 75% — «4», от 50% — «3», меньше — «2»";
export function gradeFor(correct, total) {
  const pct = total ? correct * 100 / total : 0;
  return GRADE_SCALE.find(([min]) => pct >= min)[1];
}

export function parseNumber(value) {
  const s = String(value == null ? "" : value).trim().replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/,/g, ".");
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s);
  if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const normText = s => String(s == null ? "" : s).trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").replace(/[.!]+$/, "");
const alternatives = key => String(key == null ? "" : key).split(";").map(x => x.trim()).filter(Boolean);
const sameNumber = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

// q — вопрос {type, options}, key — правильный ответ (строка), given — ответ ученика.
export function isCorrect(q, key, given) {
  if (given == null || String(given).trim() === "") return false;
  if (q.type === "choice") return String(given) === String(key);
  if (q.type === "number") return alternatives(key).some(a => sameNumber(parseNumber(given), parseNumber(a)));
  return alternatives(key).some(a => normText(a) === normText(given));
}

export function scoreOf(test, key, answers) {
  const total = test.questions.length;
  const correct = test.questions.reduce((n, q, i) => n + (key && isCorrect(q, key[i], answers[i]) ? 1 : 0), 0);
  return { correct, total };
}

// Задача из банка: если все варианты ответа — числа, сравниваем как числа, иначе как текст.
export function checkProblem(answer, given) {
  const alts = alternatives(answer);
  const numeric = alts.length && alts.every(a => Number.isFinite(parseNumber(a)));
  const q = { type:numeric ? "number" : "text" };
  // Несколько ответов через «;» (например, оба корня) — верно, если верен каждый.
  const parts = alternatives(given);
  return parts.length > 1 ? parts.every(part => isCorrect(q, answer, part)) : isCorrect(q, answer, given);
}

// Как показать правильный ответ: для выбора — текст варианта.
export function keyLabel(q, key) {
  return q.type === "choice" ? (q.options[Number(key)] ?? "") : alternatives(key).join(" или ");
}
