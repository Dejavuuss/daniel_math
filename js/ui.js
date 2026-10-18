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

/* ---------- Боковая панель разделов ---------- */

// Значки разделов (24×24, контур) — по атрибуту data-icon у кнопки.
const ICONS = {
  home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  book:'<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17"/><path d="M9 4V2.5h6V4M8.5 11l2 2 4-4M8.5 17h7"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chart:'<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/>',
  note:'<path d="M5 3.5h10l4 4v13H5z"/><path d="M15 3.5v4h4M8.5 12h7M8.5 16h7"/>',
  wallet:'<rect x="3" y="6" width="18" height="14"/><path d="M3 10h18M16 15h2"/><path d="M6 6V4h11v2"/>',
  award:'<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.3 4-6.5 8-6.5s7.2 2.2 8 6.5"/>',
  check:'<rect x="3.5" y="3.5" width="17" height="17"/><path d="m8 12.5 3 3 5.5-6"/>',
  image:'<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="9.5" r="2"/><path d="m3 18 6-5.5 4 3.5 3-2.5 5 4.5"/>',
  database:'<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
  dot:'<circle cx="12" cy="12" r="3"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;

// Разделы как отдельные экраны: один открыт, адрес (#materials) помнит какой — работает «Назад» и перезагрузка.
// Панель сворачивается до значков (запоминается), на телефоне выезжает по кнопке меню.
const NAV_KEY = "tutor_nav_collapsed";
const slug = id => id.replace(/^[tp]-/, "");
export function initTabs() {
  const nav = document.querySelector(".sidebar .tabs") || document.querySelector(".tabs");
  if (!nav) return;
  const tabs = [...nav.querySelectorAll(".tab")];
  tabs.forEach(b => {
    if (!b.querySelector(".tab-label")) {
      const text = b.textContent.trim();
      b.title = text;
      b.innerHTML = icon(b.dataset.icon) + `<span class="tab-label">${esc(text)}</span>`;
    }
    b.setAttribute("aria-controls", b.dataset.tab);
  });
  const title = document.getElementById("viewTitle");
  const body = document.body;
  const activate = (btn, remember) => {
    tabs.forEach(b => { const on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
    if (title) title.textContent = btn.querySelector(".tab-label").textContent;
    if (remember) history.replaceState(null, "", tabs[0] === btn ? location.pathname + location.search : "#" + slug(btn.dataset.tab));
    body.classList.remove("nav-open");
    scrollTo({ top:0, behavior:"auto" });
  };
  tabs.forEach(b => b.addEventListener("click", () => activate(b, true)));
  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    const b = h && tabs.find(t => slug(t.dataset.tab) === h);
    activate(b || nav.querySelector(".tab.active") || tabs[0], false);
  };
  addEventListener("hashchange", fromHash);
  fromHash();

  const toggle = document.getElementById("navToggle");
  const setCollapsed = c => {
    body.classList.toggle("nav-collapsed", c);
    if (toggle) { toggle.setAttribute("aria-expanded", String(!c)); toggle.setAttribute("aria-label", c ? "Развернуть панель" : "Свернуть панель"); toggle.title = toggle.getAttribute("aria-label"); }
  };
  try { setCollapsed(localStorage.getItem(NAV_KEY) === "1"); } catch (_) { setCollapsed(false); }
  if (toggle) toggle.addEventListener("click", () => {
    const c = !body.classList.contains("nav-collapsed");
    setCollapsed(c);
    try { localStorage.setItem(NAV_KEY, c ? "1" : "0"); } catch (_) {}
  });
  const scrim = document.createElement("div");
  scrim.className = "nav-scrim";
  body.appendChild(scrim);
  scrim.addEventListener("click", () => body.classList.remove("nav-open"));
  const menu = document.getElementById("menuBtn");
  if (menu) menu.addEventListener("click", () => body.classList.add("nav-open"));
  addEventListener("keydown", e => { if (e.key === "Escape") body.classList.remove("nav-open"); });
  // Ссылки вида <a data-open="t-gallery"> открывают раздел.
  document.addEventListener("click", e => {
    const link = e.target.closest && e.target.closest("[data-open]");
    if (!link) return;
    e.preventDefault();
    openTab(link.dataset.open);
  });
}

// Открыть раздел из кода (кнопки «Пройти тест», «Все сообщения» и т. п.).
export const openTab = id => document.querySelector(`.tab[data-tab="${id}"]`)?.click();

// Число на кнопке раздела (например, непрочитанные сообщения); 0 — убрать.
export function setTabCount(id, n) {
  const b = document.querySelector(`.tab[data-tab="${id}"]`);
  if (!b) return;
  let c = b.querySelector(".tab-count");
  if (!n) { if (c) c.remove(); return; }
  if (!c) { c = document.createElement("span"); c.className = "tab-count"; b.appendChild(c); }
  c.textContent = n;
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
