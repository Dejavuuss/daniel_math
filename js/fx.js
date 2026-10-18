// Движение «Ночного музея»: прожектор за курсором, пыль в луче света, появление при прокрутке,
// счётчики, сменяющиеся цитаты и плавные переходы между страницами.
// Всё, что движется само, выключается при prefers-reduced-motion.
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const light = { x:innerWidth * 0.72, y:innerHeight * 0.22 };

export function initPage() {
  const layer = document.createElement("div");
  layer.className = "atmosphere";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = '<div class="spot"></div><canvas></canvas><div class="vignette"></div><div class="grain"></div>';
  document.body.prepend(layer);
  spotlight();
  if (!reduceMotion) dust(layer.querySelector("canvas"));
  pageTransitions();
  reveal();
}

/* Прожектор догоняет курсор с инерцией; на сенсорных экранах медленно бродит сам. */
function spotlight() {
  const root = document.documentElement;
  const target = { x:light.x, y:light.y };
  let raf = 0;
  const apply = () => { root.style.setProperty("--mx", light.x.toFixed(1) + "px"); root.style.setProperty("--my", light.y.toFixed(1) + "px"); };
  const step = () => {
    light.x += (target.x - light.x) * 0.07;
    light.y += (target.y - light.y) * 0.07;
    apply();
    raf = Math.abs(target.x - light.x) + Math.abs(target.y - light.y) > 0.4 ? requestAnimationFrame(step) : 0;
  };
  const aim = (x, y) => {
    target.x = x; target.y = y;
    if (reduceMotion) { light.x = x; light.y = y; apply(); return; }
    if (!raf) raf = requestAnimationFrame(step);
  };
  addEventListener("pointermove", e => { if (e.pointerType === "mouse") aim(e.clientX, e.clientY); }, { passive:true });
  apply();

  if (!reduceMotion && matchMedia("(hover: none)").matches) {
    const t0 = performance.now();
    setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      aim(innerWidth * (0.5 + 0.32 * Math.sin(t * 0.21)), innerHeight * (0.35 + 0.22 * Math.sin(t * 0.13 + 1)));
    }, 120);
  }

  // Отблеск на рамах и витринах там, где курсор.
  document.addEventListener("pointermove", e => {
    const el = e.target.closest && e.target.closest(".frame, .widget");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--fx", (e.clientX - r.left) + "px");
    el.style.setProperty("--fy", (e.clientY - r.top) + "px");
  }, { passive:true });
}

/* Пылинки медленно поднимаются и разгораются, попадая в луч прожектора. */
function dust(canvas) {
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  let w = 0, h = 0, parts = [], running = true;
  let rgb = getComputedStyle(root).getPropertyValue("--dust").trim();
  new MutationObserver(() => { rgb = getComputedStyle(root).getPropertyValue("--dust").trim(); })
    .observe(root, { attributes:true, attributeFilter:["data-theme"] });

  const spawn = anywhere => ({
    x:Math.random() * w, y:anywhere ? Math.random() * h : h + 8,
    r:Math.random() * 1.3 + 0.3, vy:-(Math.random() * 0.22 + 0.04),
    ph:Math.random() * 6.283, sp:Math.random() * 0.012 + 0.003, a:Math.random() * 0.55 + 0.15
  });
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length:Math.round(Math.min(110, w * h / 14000)) }, () => spawn(true));
  }
  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.ph += p.sp; p.y += p.vy; p.x += Math.sin(p.ph) * 0.22;
      if (p.y < -8) Object.assign(p, spawn(false));
      const glow = Math.max(0, 1 - Math.hypot(p.x - light.x, p.y - light.y) / 380);
      ctx.fillStyle = `rgba(${rgb},${(p.a * (0.28 + glow * 0.9)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + glow * 0.7), 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });
  resize(); requestAnimationFrame(frame);
}

/* Появление при прокрутке. data-reveal="N" задаёт задержку N × 90 мс. */
let observer = null;
export function reveal(scope = document) {
  const els = scope.querySelectorAll("[data-reveal]:not(.is-in)");
  if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("is-in")); return; }
  observer = observer || new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); observer.unobserve(en.target); }
  }), { rootMargin:"0px 0px -6% 0px", threshold:0.06 });
  els.forEach(el => {
    el.style.setProperty("--d", (Number(el.dataset.reveal) || 0) * 0.09 + "s");
    observer.observe(el);
  });
}

/* Число «набегает» до значения; дробные выводятся с запятой. */
export function countUp(el, value) {
  if (!el) return;
  const target = Number(value);
  if (value === "" || value == null || !Number.isFinite(target)) { el.textContent = value == null ? "—" : String(value); return; }
  const decimals = (String(value).split(".")[1] || "").length;
  const fmt = n => n.toFixed(decimals).replace(".", ",");
  const from = Number(el.dataset.v || 0);
  el.dataset.v = target;
  if (reduceMotion) { el.textContent = fmt(target); return; }
  const start = performance.now(), dur = 1500;
  const tick = now => {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(from + (target - from) * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* Цитаты сменяются по окончании золотой полосы слева. */
export function rotateQuotes(el, quotes, interval = 9000) {
  if (!el || !quotes.length) return;
  let i = Math.floor(Math.random() * quotes.length);
  el.innerHTML = '<span class="q-progress"></span><div class="q-item" aria-live="polite"><q></q><cite></cite></div>';
  const item = el.querySelector(".q-item");
  const show = () => { item.querySelector("q").textContent = quotes[i][0]; item.querySelector("cite").textContent = quotes[i][1]; };
  show();
  if (reduceMotion || quotes.length < 2) return;
  el.style.setProperty("--q-int", interval + "ms");
  el.classList.add("running");
  el.querySelector(".q-progress").addEventListener("animationiteration", () => {
    item.classList.add("out");
    setTimeout(() => { i = (i + 1) % quotes.length; show(); item.classList.remove("out"); }, 900);
  });
}

/* Плавный уход со страницы перед переходом по внутренней ссылке. */
export function leave(url) {
  document.body.classList.add("leaving");
  setTimeout(() => { location.href = url; }, reduceMotion ? 0 : 320);
}
function pageTransitions() {
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download") || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    // Только обычные страницы сайта: ссылки на скачивание (blob:) и прочие схемы не трогаем.
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || url.pathname === location.pathname) return;
    e.preventDefault();
    leave(url.href);
  });
  addEventListener("pageshow", e => { if (e.persisted) document.body.classList.remove("leaving"); });
}
