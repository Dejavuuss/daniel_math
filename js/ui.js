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
