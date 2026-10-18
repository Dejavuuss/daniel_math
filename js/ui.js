// Общие элементы интерфейса и разметка, которую используют несколько кабинетов.
import { reduceMotion, reveal } from "./fx.js";

export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
export const byDate = (a, b) => String(a.date).localeCompare(String(b.date));

const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
// "2026-10-15" → "15 октября" (текст, экранировать при вставке)
export function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? `${+m[3]} ${MONTHS_GEN[+m[2] - 1]}` : String(s || "");
}
export function daysUntil(s) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  const now = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
export function stars(n) {
  const k = Math.max(0, Math.min(5, Number(n) || 0));
  return "★".repeat(k) + "☆".repeat(5 - k);
}
export function average(grades) {
  return grades.length ? (grades.reduce((s, g) => s + Number(g.grade || 0), 0) / grades.length).toFixed(1) : "—";
}

/* ---------- Раскрывающиеся группы ---------- */

// Состояние групп переживает перерисовку списков (после сохранения записи группы не схлопываются).
const foldState = new Map();
document.addEventListener("toggle", e => {
  const d = e.target;
  if (d instanceof HTMLDetailsElement && d.dataset.fold) foldState.set(d.dataset.fold, d.open);
}, true);

// key — уникальный ключ группы; opts.open — открыта ли по умолчанию; opts.count — число справа; opts.note — подпись.
export function fold(key, title, inner, opts = {}) {
  const open = foldState.has(key) ? foldState.get(key) : !!opts.open;
  return `<details class="fold" data-fold="${esc(key)}"${open ? " open" : ""}>
    <summary><span class="fold-title">${title}</span>${opts.note ? `<span class="fold-note">${esc(opts.note)}</span>` : ""}${opts.count != null ? `<span class="fold-count">${esc(opts.count)}</span>` : ""}</summary>
    <div class="fold-body">${inner}</div>
  </details>`;
}

// Группировка массива: [[ключ, элементы], …] в порядке order (или по первому появлению).
export function groupBy(list, keyOf, order) {
  const map = new Map();
  (order || []).forEach(k => map.set(k, []));
  list.forEach(x => { const k = keyOf(x); if (!map.has(k)) map.set(k, []); map.get(k).push(x); });
  return [...map.entries()].filter(([, items]) => items.length);
}

const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const monthOf = s => { const m = /^(\d{4})-(\d{2})/.exec(String(s || "")); return m ? `${MONTHS_NOM[+m[2] - 1]} ${m[1]}` : "Без даты"; };
export const classLabel = g => g === "" || g == null ? "Для всех классов" : `${g} класс`;

/* ---------- Родительный падеж имени («успеваемость Захара») ---------- */

// Мужские имена на -а/-я: по ним понятно, что фамилию склонять как мужскую.
const MALE_A = new Set("никита илья кузьма фома лука савва данила гаврила саша женя миша дима ваня петя коля вова гоша лёша леша паша тима тимоха сеня федя юра гриша слава стёпа степа боря толя костя митя лёва лева яша гена рома вася валера серёжа сережа андрюша тёма тема егорка".split(" "));
const FIRST_EXCEPT = { "лев":"Льва", "павел":"Павла", "пётр":"Петра", "петр":"Петра" };
const cap = w => w ? w[0].toUpperCase() + w.slice(1) : w;
const HUSHING = /[гкхжшщч]$/;

function genFirst(w) {
  const l = w.toLowerCase();
  if (FIRST_EXCEPT[l]) return FIRST_EXCEPT[l];
  if (l.endsWith("я")) return w.slice(0, -1) + "и";                         // Илья → Ильи, Мария → Марии
  if (l.endsWith("а")) return w.slice(0, -1) + (HUSHING.test(l.slice(0, -1)) ? "и" : "ы"); // Никита → Никиты, Саша → Саши
  if (/[йь]$/.test(l)) return w.slice(0, -1) + "я";                          // Алексей → Алексея, Игорь → Игоря
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(l)) return w + "а";                     // Захар → Захара
  return w;
}
function genSurname(w, female) {
  const l = w.toLowerCase();
  if (female) {
    if (/(ов|ев|ёв|ин|ын)а$/.test(l)) return w.slice(0, -1) + "ой";           // Петрова → Петровой
    if (/ая$/.test(l)) return w.slice(0, -2) + "ой";                          // Белая → Белой
    if (/[ая]$/.test(l)) return genFirst(w);
    return w;                                                                 // Шмидт (жен.) не склоняется
  }
  if (/(ий|ый|ой)$/.test(l)) return w.slice(0, -2) + "ого";                   // Белый → Белого
  if (/[бвгджзклмнпрстфхцчшщйь]$/.test(l) || /[ая]$/.test(l)) return genFirst(w);
  return w;                                                                   // Шевченко, Черных
}
// «Имя [Отчество] [Фамилия]» → родительный падеж. Неочевидные случаи репетитор задаёт вручную (users.nameGen).
export function genitive(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = words[0].toLowerCase(), female = /[ая]$/.test(first) && !MALE_A.has(first);
  return words.map((w, i) => cap(i === 0 ? genFirst(w)
    : /(ич)$/i.test(w) ? w + "а" : /(вна|чна|шна)$/i.test(w) ? genFirst(w) : genSurname(w, female))).join(" ");
}

export function showToast(msg, isError = false) {
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.setAttribute("role", isError ? "alert" : "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 450); }, 3500);
}

export function setStatus(el, text, state) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("ok", state === "ok");
  el.classList.toggle("bad", state === "bad");
}

/* Вкладки: золотая черта переезжает под активную. */
export function initTabs() {
  const bar = document.querySelector(".tabs");
  if (!bar) return;
  const ink = document.createElement("span");
  ink.className = "tab-ink";
  bar.appendChild(ink);
  const tabs = [...bar.querySelectorAll(".tab")];
  const move = btn => { ink.style.width = btn.offsetWidth + "px"; ink.style.transform = `translateX(${btn.offsetLeft}px)`; };
  tabs.forEach(btn => btn.addEventListener("click", () => {
    tabs.forEach(b => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", String(b === btn)); });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
    move(btn);
    btn.scrollIntoView({ block:"nearest", inline:"nearest", behavior:reduceMotion ? "auto" : "smooth" });
  }));
  const sync = () => move(bar.querySelector(".tab.active") || tabs[0]);
  addEventListener("resize", sync);
  if (document.fonts) document.fonts.ready.then(sync);
  sync();
}

/* Показатели под вступлением: [число, подпись]. При обновлении числа плавно перетекают к новым значениям. */
export function mountStats(el, list, countUp) {
  if (el.children.length !== list.length) {
    el.innerHTML = list.map(([, label], i) => `<article class="stat-card" data-reveal="${i}"><strong>0</strong><span class="label">${esc(label)}</span></article>`).join("");
    reveal(el);
  }
  el.querySelectorAll("strong").forEach((s, i) => countUp(s, list[i][0]));
}

export function gradeBars(grades) {
  const list = grades.slice().sort(byDate).slice(-10);
  if (!list.length) return '<p class="muted small">Оценок пока нет.</p>';
  return list.map((g, i) => `<div class="progress-bar" style="height:${Number(g.grade) / 5 * 100}%;--i:${i}" data-label="${esc(g.grade)}" title="${esc(g.subject)}, ${esc(fmtDate(g.date))}"></div>`).join("");
}

export function medallions(list) {
  if (!list.length) return '<p class="muted small">Пока пусто — первая награда впереди.</p>';
  return list.slice(-6).map(a => `<div class="achievement" title="${esc(a.description || "")}"><div class="achievement-icon">${esc(a.icon || "🏆")}</div><div class="achievement-title">${esc(a.title)}</div><div class="achievement-desc">${esc(fmtDate(a.date))}</div></div>`).join("");
}

export function noteHtml(n, student) {
  return `<article class="lesson-note">
    <div class="lesson-note-header"><span class="lesson-note-topic">${esc(n.topic)}</span>
    <span class="lesson-note-meta">${esc(fmtDate(n.date))}, ${esc(n.duration)} мин <span class="lesson-note-rating" title="Усвоение: ${esc(n.rating)} из 5">${stars(n.rating)}</span></span></div>
    ${student ? `<div class="lesson-note-meta">Ученик: ${esc(student)}</div>` : ""}
    <div class="lesson-note-text">${esc(n.note)}</div>
  </article>`;
}

// extra — готовая разметка под текстом (например, прикреплённые файлы).
export function messageHtml(m, me, nameOf, extra = "") {
  const out = m.from === me;
  return `<div class="message${out ? " outgoing" : ""}${!out && !m.isRead ? " unread" : ""}">
    <div class="message-meta">${out ? "Кому: " + esc(nameOf(m.to)) : "От: " + esc(nameOf(m.from))}, ${esc(fmtDate(m.date))}</div>
    <div class="message-text">${esc(m.text)}</div>${extra}
  </div>`;
}
