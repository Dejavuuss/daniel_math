// «Гравюры» залов: линейные SVG-оммажи шедеврам, в которых спрятана математика.
// mountArt(host, name) рисует работу в контейнер и оживляет её, пока она видна на экране.
import { reduceMotion } from "./fx.js";

export const QUOTES = {
  login:[
    ["Пусть не читает меня тот, кто не математик.", "Леонардо да Винчи"],
    ["Нельзя быть математиком, не будучи в то же время поэтом в душе.", "Софья Ковалевская"],
    ["Бог всегда геометризует.", "Платон"]
  ],
  student:[
    ["Геометрия — истинное основание всей живописи.", "Альбрехт Дюрер"],
    ["Я всё ещё учусь.", "Микеланджело Буонарроти, в 87 лет"],
    ["Математика — это искусство называть разные вещи одним и тем же именем.", "Анри Пуанкаре"],
    ["В математике нет символов для неясных мыслей.", "Анри Пуанкаре"]
  ],
  parent:[
    ["К ста десяти годам каждая точка, каждая линия у меня будут живыми.", "Кацусика Хокусай"],
    ["Книга природы написана на языке математики.", "Галилео Галилей"],
    ["Всё есть число.", "Пифагор"]
  ],
  admin:[
    ["В геометрии нет царской дороги.", "Евклид, царю Птолемею"],
    ["Нельзя научить человека чему-либо; можно лишь помочь ему открыть это в себе.", "Галилео Галилей"],
    ["Математика — царица наук.", "Карл Фридрих Гаусс"]
  ]
};

const ARTWORKS = { vitruvian, melencolia, wave, athens };
export function mountArt(host, name) {
  if (host && ARTWORKS[name]) ARTWORKS[name](host);
}

/* ---------- Инструменты ---------- */

const NS = "http://www.w3.org/2000/svg";
function make(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function stage(host, label) {
  const svg = make("svg", { viewBox:"0 0 400 400", class:"art", role:"img", "aria-label":label });
  host.appendChild(svg);
  return svg;
}
// Длина линии нужна CSS-анимации «прорисовки» (.draw).
function prepDraw(svg) {
  svg.querySelectorAll(".draw").forEach(p => p.style.setProperty("--len", Math.ceil(p.getTotalLength ? p.getTotalLength() : 1200)));
}
const pts = list => list.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
const ease = t => (1 - Math.cos(t * Math.PI)) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// Покадровая анимация, которая спит, пока работа за пределами экрана или вкладка скрыта.
function animate(svg, fn) {
  if (reduceMotion) { fn(0); return; }
  let visible = true, t0 = performance.now();
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
  const frame = now => {
    if (visible && !document.hidden) fn((now - t0) / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Логарифмическая спираль r = a·e^(bθ); при b = ln φ / (π/2) это золотая спираль.
function logSpiral(cx, cy, a, b, rMax, turn = 0, dir = 1) {
  const out = [];
  for (let t = 0; ; t += 0.06) {
    const r = a * Math.exp(b * t);
    if (r > rMax) break;
    out.push([cx + r * Math.cos(turn + dir * t), cy + r * Math.sin(turn + dir * t)]);
  }
  return out;
}

/* ---------- Леонардо да Винчи. Витрувианский человек ---------- */

function vitruvian(host) {
  const s = stage(host, "Линейный рисунок по мотивам «Витрувианского человека» Леонардо да Винчи");
  const C = [200, 192], R = 158;
  const spiral = make("polyline", { class:"ink-faint", points:pts(logSpiral(C[0], C[1], 1.6, Math.log(1.618) / (Math.PI / 2), 196)) }, s);
  make("rect", { class:"ink draw", x:70, y:90, width:260, height:260, style:"--d:.15s" }, s);
  make("circle", { class:"ink draw", cx:C[0], cy:C[1], r:R, style:"--d:.45s" }, s);
  // Деления: рост — восемь голов, размах рук равен росту.
  for (let i = 1; i < 8; i++) {
    make("line", { class:"ink-soft", x1:70 + i * 32.5, y1:350, x2:70 + i * 32.5, y2:342 }, s);
    make("line", { class:"ink-soft", x1:70, y1:90 + i * 32.5, x2:78, y2:90 + i * 32.5 }, s);
  }
  make("circle", { class:"ink draw", cx:200, cy:116, r:18, style:"--d:1s" }, s);
  make("line", { class:"ink draw", x1:200, y1:134, x2:200, y2:224, style:"--d:1.15s" }, s);
  make("line", { class:"ink draw", x1:176, y1:152, x2:224, y2:152, style:"--d:1.25s" }, s);
  make("line", { class:"ink draw", x1:190, y1:224, x2:210, y2:224, style:"--d:1.3s" }, s);
  make("circle", { cx:C[0], cy:C[1], r:2.2, fill:"currentColor" }, s);

  const joints = [[176,152],[224,152],[192,224],[208,224]];
  const poseA = [[70,152],[330,152],[189,350],[211,350]];   // руки в стороны — квадрат
  const poseB = [[79,91],[321,91],[121,329],[279,329]];     // руки вверх, ноги врозь — круг
  joints.forEach((j, i) => {
    make("line", { class:"ink-soft", x1:j[0], y1:j[1], x2:poseA[i][0], y2:poseA[i][1] }, s);
    make("line", { class:"ink-soft", x1:j[0], y1:j[1], x2:poseB[i][0], y2:poseB[i][1] }, s);
  });
  const limbs = joints.map(j => make("line", { class:"ink", x1:j[0], y1:j[1], x2:j[0], y2:j[1] }, s));
  prepDraw(s);

  animate(s, t => {
    const k = ease((Math.sin(t * 0.8 - 1.4) + 1) / 2);
    limbs.forEach((l, i) => {
      l.setAttribute("x2", lerp(poseA[i][0], poseB[i][0], k).toFixed(1));
      l.setAttribute("y2", lerp(poseA[i][1], poseB[i][1], k).toFixed(1));
    });
    spiral.setAttribute("transform", `rotate(${(t * 3) % 360} ${C[0]} ${C[1]})`);
  });
}

/* ---------- Альбрехт Дюрер. Меланхолия I ---------- */

const MAGIC = [[16,3,2,13],[5,10,11,8],[9,6,7,12],[4,15,14,1]];

function melencolia(host) {
  const s = stage(host, "Магический квадрат 4 на 4 с гравюры Дюрера «Меланхолия I»");
  const solid = make("g", { class:"ink-faint" }, s);
  const solidEdges = durerSolid().map(() => make("line", {}, solid));
  const X0 = 80, Y0 = 52, CELL = 60;
  make("rect", { class:"ink draw", x:X0 - 8, y:Y0 - 8, width:CELL * 4 + 16, height:CELL * 4 + 16, style:"--d:.1s" }, s);
  const cells = [];
  MAGIC.forEach((row, r) => row.forEach((n, c) => {
    const g = make("g", { class:"ms-cell", "data-r":r, "data-c":c }, s);
    make("rect", { x:X0 + c * CELL + 3, y:Y0 + r * CELL + 3, width:CELL - 6, height:CELL - 6 }, g);
    const tx = make("text", { x:X0 + c * CELL + CELL / 2, y:Y0 + r * CELL + CELL / 2 + 1 }, g);
    tx.textContent = n;
    cells.push(g);
  }));
  const sum = make("text", { class:"ms-sum", x:200, y:350 }, s);
  prepDraw(s);

  const groups = [];
  const label = list => list.map(([r, c]) => MAGIC[r][c]).join(" + ") + " = 34";
  for (let i = 0; i < 4; i++) groups.push([...Array(4)].map((_, c) => [i, c]));
  for (let i = 0; i < 4; i++) groups.push([...Array(4)].map((_, r) => [r, i]));
  groups.push([[0,0],[1,1],[2,2],[3,3]], [[0,3],[1,2],[2,1],[3,0]], [[0,0],[0,3],[3,0],[3,3]], [[1,1],[1,2],[2,1],[2,2]]);
  [[0,0],[0,2],[2,0],[2,2]].forEach(([r, c]) => groups.push([[r,c],[r,c+1],[r+1,c],[r+1,c+1]]));
  const year = [[3,1],[3,2]];

  const light = (list, text) => {
    cells.forEach(g => g.classList.toggle("on", list.some(([r, c]) => +g.dataset.r === r && +g.dataset.c === c)));
    sum.style.opacity = 0;
    setTimeout(() => { sum.textContent = text; sum.style.opacity = 1; }, 220);
  };
  let step = 0, paused = false;
  const tick = () => {
    if (paused || document.hidden) return;
    if (step === groups.length) light(year, "15 и 14 — год гравюры, 1514");
    else light(groups[step], label(groups[step]));
    step = (step + 1) % (groups.length + 1);
  };
  tick();
  if (!reduceMotion) setInterval(tick, 1900);

  // Наведение на клетку показывает сумму её строки.
  cells.forEach(g => {
    g.addEventListener("pointerenter", () => { paused = true; const r = +g.dataset.r; light(groups[r], label(groups[r])); });
    g.addEventListener("pointerleave", () => { paused = false; });
  });

  const edges = durerSolid();
  animate(s, t => {
    const a = t * 0.25, b = 0.55 + Math.sin(t * 0.17) * 0.2;
    const P = ([x, y, z]) => {
      const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
      const y1 = y * Math.cos(b) - z1 * Math.sin(b);
      return [200 + x1 * 92, 172 + y1 * 92];
    };
    edges.forEach(([p, q], i) => {
      const A = P(p), B = P(q), l = solidEdges[i];
      l.setAttribute("x1", A[0].toFixed(1)); l.setAttribute("y1", A[1].toFixed(1));
      l.setAttribute("x2", B[0].toFixed(1)); l.setAttribute("y2", B[1].toFixed(1));
    });
  });
}

// «Тело Дюрера»: куб, вытянутый вдоль диагонали, с двумя срезанными вершинами (12 вершин, 18 рёбер).
function durerSolid() {
  const k = 1.45, t = 0.32, u = 1 / Math.sqrt(3);
  const stretch = v => { const d = (v[0] + v[1] + v[2]) * u * (k - 1); return [v[0] + d * u, v[1] + d * u, v[2] + d * u]; };
  const cube = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  const isApex = v => Math.abs(v[0] + v[1] + v[2]) === 3;
  const cut = (apex, n) => apex.map((a, i) => a + t * (n[i] - a));
  const edges = [], tri = { top:[], bottom:[] };
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = cube[i], b = cube[j];
    if (a.filter((v, n) => v !== b[n]).length !== 1) continue;
    if (isApex(a) || isApex(b)) {
      const [apex, n] = isApex(a) ? [a, b] : [b, a];
      const p = cut(apex, n);
      (apex[0] > 0 ? tri.top : tri.bottom).push(p);
      edges.push([p, n]);
    } else edges.push([a, b]);
  }
  for (const side of [tri.top, tri.bottom]) for (let i = 0; i < 3; i++) edges.push([side[i], side[(i + 1) % 3]]);
  return edges.map(([a, b]) => [stretch(a), stretch(b)]);
}

/* ---------- Кацусика Хокусай. Большая волна в Канагаве ---------- */

function wave(host) {
  const s = stage(host, "Линейный рисунок по мотивам «Большой волны в Канагаве» Хокусая: самоподобный гребень и гора Фудзи");
  const C = [150, 150];
  // Гребень — спираль, закручивающаяся влево; «когти» — её уменьшенные копии, на которых свои копии.
  const curl = [];
  for (let t = 0; t < 11.5; t += 0.05) { const r = 122 * Math.exp(-0.2 * t); curl.push([r * Math.cos(-t), r * Math.sin(-t)]); }
  const place = (shape, x, y, sc, rot) => shape.map(([px, py]) => [x + sc * (px * Math.cos(rot) - py * Math.sin(rot)), y + sc * (px * Math.sin(rot) + py * Math.cos(rot))]);

  const body = make("g", {}, s);
  make("path", { class:"ink draw", d:"M398,302 C330,292 282,236 272,150", style:"--d:.2s" }, body);
  make("path", { class:"ink-soft draw", d:"M398,318 C318,306 262,246 252,160", style:"--d:.35s" }, body);
  make("polyline", { class:"ink draw", points:pts(place(curl, C[0], C[1], 1, 0)), style:"--d:.5s" }, body);
  make("polyline", { class:"ink-soft draw", points:pts(place(curl, C[0] + 6, C[1] + 4, 0.86, 0.1)), style:"--d:.7s" }, body);

  const claws = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.35 + i * 0.32, r = 122 * Math.exp(-0.2 * t);
    const x = C[0] + r * Math.cos(-t), y = C[1] + r * Math.sin(-t), rot = -t + Math.PI * 0.95;
    const g = make("g", {}, body);
    const big = make("polyline", { class:"ink", points:pts(place(curl, 0, 0, 0.15, 0)) }, g);
    const small = [0.3, 0.75, 1.2].map(tt => {
      const rr = 122 * Math.exp(-0.2 * tt) * 0.15;
      return make("polyline", { class:"ink-soft", points:pts(place(curl, rr * Math.cos(-tt), rr * Math.sin(-tt), 0.045, -tt + 3)) }, g);
    });
    claws.push({ g, x, y, rot, big, small, ph:i * 0.7 });
  }

  // Фудзи в ложбине волны.
  make("path", { class:"ink draw", d:"M150,302 L196,262 L242,302", style:"--d:1.2s" }, s);
  make("path", { class:"ink-soft", d:"M182,274 L188,269 L195,276 L202,268 L209,274" }, s);

  const sea = [...Array(6)].map(() => make("polyline", { class:"ink-soft" }, s));
  const foam = [...Array(14)].map(() => ({ el:make("circle", { r:(Math.random() * 1.6 + 0.8).toFixed(1), fill:"currentColor", opacity:".55" }, s), x:Math.random() * 230 + 30, y:Math.random() * 120 + 20, v:Math.random() * 6 + 4 }));
  prepDraw(s);

  animate(s, t => {
    body.setAttribute("transform", `rotate(${(Math.sin(t * 0.5) * 1.4).toFixed(2)} 260 320)`);
    claws.forEach(c => {
      const sc = 1 + Math.sin(t * 1.3 + c.ph) * 0.08;
      c.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(c.rot * 180 / Math.PI).toFixed(1)}) scale(${sc.toFixed(3)})`);
    });
    sea.forEach((l, j) => {
      const line = [];
      for (let x = 0; x <= 400; x += 8) line.push([x, 312 + j * 15 + Math.sin(x * (0.028 + j * 0.004) + t * (0.9 + j * 0.15) + j) * (3 + j * 0.9)]);
      l.setAttribute("points", pts(line));
    });
    foam.forEach(f => {
      const y = (f.y + t * f.v) % 300, x = f.x + Math.sin(t * 0.8 + f.y) * 6;
      f.el.setAttribute("cx", x.toFixed(1)); f.el.setAttribute("cy", (y + 20).toFixed(1));
    });
  });
}

/* ---------- Рафаэль Санти. Афинская школа ---------- */

function athens(host) {
  const s = stage(host, "Линейная перспектива по мотивам «Афинской школы» Рафаэля: арки сходятся в одной точке, Евклид чертит циркулем");
  const EYE = 80;                       // высота глаза над полом
  const DEPTHS = [1.3, 2, 3.1, 4.8, 7.4];
  const ARCH = { half:110, spring:150, radius:110 };
  const g = make("g", {}, s);
  const floorLines = [...Array(13)].map(() => make("line", { class:"ink-faint" }, g));
  const rungs = [...Array(9)].map(() => make("line", { class:"ink-faint" }, g));
  const rays = [...Array(5)].map(() => make("line", { class:"ink-soft" }, g));
  const arches = DEPTHS.map((_, i) => make("path", { class:i ? "ink-soft" : "ink" }, g));
  const vp = make("circle", { r:2.4, fill:"currentColor" }, g);
  const plato = make("path", { class:"ink" }, g), aristotle = make("path", { class:"ink" }, g);

  // Евклид: циркуль чертит окружность на полу (в перспективе — эллипс).
  const E = [318, 368], ER = 28;
  const trail = make("ellipse", { class:"ink-soft", cx:E[0], cy:E[1], rx:ER, ry:ER * 0.34 }, s);
  const legA = make("line", { class:"ink" }, s), legB = make("line", { class:"ink" }, s);
  const hinge = make("circle", { r:2.2, fill:"currentColor" }, s);
  const trailLen = Math.PI * (3 * (ER + ER * 0.34) - Math.sqrt((3 * ER + ER * 0.34) * (ER + 3 * ER * 0.34)));
  trail.style.strokeDasharray = trailLen;

  const target = { x:200, y:170 }, cur = { x:200, y:170 };
  addEventListener("pointermove", e => {
    target.x = 200 + (e.clientX / innerWidth - 0.5) * 26;
    target.y = 170 + (e.clientY / innerHeight - 0.5) * 14;
  }, { passive:true });

  const set = (el, a) => { for (const k in a) el.setAttribute(k, typeof a[k] === "number" ? a[k].toFixed(1) : a[k]); };
  animate(s, t => {
    cur.x += (target.x - cur.x) * 0.05; cur.y += (target.y - cur.y) * 0.05;
    const P = (X, Y, z) => [cur.x + X / z, cur.y + (EYE - Y) / z];
    floorLines.forEach((l, i) => { const A = P(-600 + i * 100, 0, 0.35), B = P(-600 + i * 100, 0, 9); set(l, { x1:A[0], y1:A[1], x2:B[0], y2:B[1] }); });
    rungs.forEach((l, i) => { const z = 0.35 * Math.pow(1.45, i), A = P(-700, 0, z), B = P(700, 0, z); set(l, { x1:A[0], y1:A[1], x2:B[0], y2:B[1] }); });
    [[-ARCH.half, 0], [ARCH.half, 0], [-ARCH.half, ARCH.spring], [ARCH.half, ARCH.spring], [0, ARCH.spring + ARCH.radius]].forEach(([X, Y], i) => {
      const A = P(X, Y, DEPTHS[0]), B = P(X, Y, 40); set(rays[i], { x1:A[0], y1:A[1], x2:B[0], y2:B[1] });
    });
    DEPTHS.forEach((z, i) => {
      const L0 = P(-ARCH.half, 0, z), L1 = P(-ARCH.half, ARCH.spring, z), R1 = P(ARCH.half, ARCH.spring, z), R0 = P(ARCH.half, 0, z), r = ARCH.radius / z;
      arches[i].setAttribute("d", `M${L0[0].toFixed(1)},${L0[1].toFixed(1)} L${L1[0].toFixed(1)},${L1[1].toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${R1[0].toFixed(1)},${R1[1].toFixed(1)} L${R0[0].toFixed(1)},${R0[1].toFixed(1)}`);
    });
    set(vp, { cx:cur.x, cy:cur.y });
    // Платон указывает вверх, Аристотель — вперёд, на землю.
    const z = 5.6, f = P(-14, 0, z), h = 170 / z;
    plato.setAttribute("d", `M${f[0].toFixed(1)},${f[1].toFixed(1)} v${(-h).toFixed(1)} m0,${(h * 0.22).toFixed(1)} l-3,${(-h * 0.45).toFixed(1)}`);
    const f2 = P(14, 0, z);
    aristotle.setAttribute("d", `M${f2[0].toFixed(1)},${f2[1].toFixed(1)} v${(-h).toFixed(1)} m0,${(h * 0.25).toFixed(1)} l7,2`);

    const a = t * 0.9, p = [E[0] + ER * Math.cos(a), E[1] + ER * 0.34 * Math.sin(a)];
    const H = [(E[0] + p[0]) / 2, (E[1] + p[1]) / 2 - 44];
    set(legA, { x1:H[0], y1:H[1], x2:E[0], y2:E[1] });
    set(legB, { x1:H[0], y1:H[1], x2:p[0], y2:p[1] });
    set(hinge, { cx:H[0], cy:H[1] });
    trail.style.strokeDashoffset = (trailLen * (1 - ((a / (2 * Math.PI)) % 1))).toFixed(1);
  });
}
