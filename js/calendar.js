/* Календарь 2026 — собственная реализация без библиотек.
   Использование: renderCalendar(containerEl, events)
   events: [{ date: "2026-01-10", time: "16:00", type: "lesson|deadline|test|olympiad", title: "..." }] */
import { esc, fmtDate } from "./ui.js";

const CAL_YEAR = 2026;
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const TYPE_INFO = {
  lesson:   "Занятие",
  deadline: "Дедлайн ДЗ",
  test:     "Контрольная",
  olympiad: "Олимпиада"
};

const pad = n => String(n).padStart(2, "0");

export function renderCalendar(root, events) {
  const now = new Date();
  let month = now.getFullYear() === CAL_YEAR ? now.getMonth() : 0;
  let selected = null;

  const byDate = {};
  events.forEach(ev => { const date = String(ev.date || "").slice(0, 10); if (date) (byDate[date] = byDate[date] || []).push(Object.assign({}, ev, { date })); });
  Object.values(byDate).forEach(list => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));

  function draw() {
    const first = new Date(CAL_YEAR, month, 1);
    const daysInMonth = new Date(CAL_YEAR, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // неделя с понедельника
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let html = `<div class="cal-nav">
      <button class="cal-prev" aria-label="Предыдущий месяц" ${month === 0 ? "disabled" : ""}>‹</button>
      <h2>${MONTHS[month]} ${CAL_YEAR}</h2>
      <button class="cal-next" aria-label="Следующий месяц" ${month === 11 ? "disabled" : ""}>›</button>
    </div>
    <div class="month-pills">${MONTHS.map((m, i) => `<button data-m="${i}" class="${i === month ? "active" : ""}">${m.slice(0, 3)}</button>`).join("")}</div>
    <div class="cal-grid">${WEEKDAYS.map(d => `<div class="cal-head">${d}</div>`).join("")}`;

    for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${CAL_YEAR}-${pad(month + 1)}-${pad(d)}`;
      const evs = byDate[ds] || [];
      const types = [...new Set(evs.map(e => e.type))];
      const cls = ["cal-day", evs.length ? "has-events" : "", ds === todayStr ? "today" : "", ds === selected ? "selected" : ""].join(" ");
      const label = `${d} ${fmtDate(ds).split(" ")[1]}${evs.length ? ", событий: " + evs.length : ""}`;
      html += `<div class="${cls}" data-date="${ds}" style="--i:${d}" role="button" tabindex="0" aria-label="${label}">${d}<div class="dots">${types.map(t => `<span class="dot ${esc(t)}"></span>`).join("")}</div></div>`;
    }
    html += `</div>
    <div class="legend">${Object.entries(TYPE_INFO).map(([k, v]) => `<span><i class="dot ${k}"></i>${v}</span>`).join("")}</div>
    <div class="day-events"></div>`;

    root.innerHTML = html;

    root.querySelector(".cal-prev").onclick = () => { month--; selected = null; draw(); };
    root.querySelector(".cal-next").onclick = () => { month++; selected = null; draw(); };
    root.querySelectorAll(".month-pills button").forEach(b => b.onclick = () => { month = +b.dataset.m; selected = null; draw(); });
    root.querySelectorAll(".cal-day[data-date]").forEach(c => {
      const pick = () => { selected = c.dataset.date; draw(); root.querySelector(`[data-date="${selected}"]`).focus({ preventScroll:true }); };
      c.onclick = pick;
      c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    });
    const pills = root.querySelector(".month-pills"), active = pills.querySelector(".active");
    pills.scrollLeft = active.offsetLeft - pills.clientWidth / 2 + active.offsetWidth / 2;

    if (selected) showDay(selected);
  }

  function showDay(ds) {
    const box = root.querySelector(".day-events");
    const evs = byDate[ds] || [];
    let html = `<h3>${esc(fmtDate(ds))}</h3>`;
    if (!evs.length) html += `<p class="muted">В этот день событий нет.</p>`;
    evs.forEach((ev, i) => {
      html += `<div class="ev ${esc(ev.type)}" style="animation-delay:${i * 80}ms">
        <strong><i class="dot ${esc(ev.type)}"></i>${esc(TYPE_INFO[ev.type] || ev.type)}${ev.time ? ", " + esc(ev.time) : ""}</strong><div>${esc(ev.title)}</div>${ev.description ? `<div class="muted small">${esc(ev.description)}</div>` : ""}
      </div>`;
    });
    box.innerHTML = html;
  }

  draw();
}
