/* Календарь 2026 — собственная реализация без библиотек.
   Использование: renderCalendar(containerEl, events)
   events: [{ date: "2026-01-10", time: "16:00", type: "lesson|deadline|test|olympiad", title: "..." }] */

const CAL_YEAR = 2026;
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const TYPE_INFO = {
  lesson:   { label: "Занятие",        icon: "🔵" },
  deadline: { label: "Дедлайн ДЗ",     icon: "🟠" },
  test:     { label: "Контрольная",    icon: "🔴" },
  olympiad: { label: "Олимпиада",      icon: "🟢" }
};

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pad(n) { return String(n).padStart(2, "0"); }

function renderCalendar(root, events) {
  const now = new Date();
  let month = now.getFullYear() === CAL_YEAR ? now.getMonth() : 0;
  let selected = null;

  const byDate = {};
  events.forEach(ev => { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });
  Object.values(byDate).forEach(list => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));

  function draw() {
    const first = new Date(CAL_YEAR, month, 1);
    const daysInMonth = new Date(CAL_YEAR, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // неделя с понедельника
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let html = `<div class="cal-nav">
      <button id="calPrev" ${month === 0 ? "disabled" : ""}>←</button>
      <h2>${MONTHS[month]} ${CAL_YEAR}</h2>
      <button id="calNext" ${month === 11 ? "disabled" : ""}>→</button>
    </div>
    <div class="month-pills">${MONTHS.map((m, i) => `<button data-m="${i}" class="${i === month ? "active" : ""}">${m.slice(0, 3)}</button>`).join("")}</div>
    <div class="cal-grid">${WEEKDAYS.map(d => `<div class="cal-head">${d}</div>`).join("")}`;

    for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${CAL_YEAR}-${pad(month + 1)}-${pad(d)}`;
      const evs = byDate[ds] || [];
      const types = [...new Set(evs.map(e => e.type))];
      const cls = ["cal-day", evs.length ? "has-events" : "", ds === todayStr ? "today" : "", ds === selected ? "selected" : ""].join(" ");
      html += `<div class="${cls}" data-date="${ds}">${d}<div class="dots">${types.map(t => `<span class="dot ${t}"></span>`).join("")}</div></div>`;
    }
    html += `</div>
    <div class="legend">${Object.entries(TYPE_INFO).map(([k, v]) => `<span>${v.icon} ${v.label}</span>`).join("")}</div>
    <div id="dayEvents" style="margin-top:16px"></div>`;

    root.innerHTML = html;

    root.querySelector("#calPrev").onclick = () => { month--; selected = null; draw(); };
    root.querySelector("#calNext").onclick = () => { month++; selected = null; draw(); };
    root.querySelectorAll(".month-pills button").forEach(b => b.onclick = () => { month = +b.dataset.m; selected = null; draw(); });
    root.querySelectorAll(".cal-day[data-date]").forEach(c => c.onclick = () => { selected = c.dataset.date; draw(); });

    if (selected) showDay(selected);
  }

  function showDay(ds) {
    const box = root.querySelector("#dayEvents");
    const evs = byDate[ds] || [];
    const [y, m, d] = ds.split("-");
    let html = `<h3>${+d} ${MONTHS[+m - 1].toLowerCase().replace(/ь$/, "я").replace(/т$/, "та").replace(/й$/, "я")}</h3>`;
    if (!evs.length) html += `<p class="muted">В этот день событий нет.</p>`;
    evs.forEach(ev => {
      const t = TYPE_INFO[ev.type] || { label: ev.type, icon: "⚪" };
      html += `<div class="ev ${escapeHtml(ev.type)}">
        <strong>${t.icon} ${t.label}${ev.time ? " · " + escapeHtml(ev.time) : ""}</strong><br>${escapeHtml(ev.title)}
      </div>`;
    });
    box.innerHTML = html;
  }

  draw();
}
