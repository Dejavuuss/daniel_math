// Движение сайта: появление при прокрутке, счётчики, сменяющиеся цитаты и переходы между страницами.
// Швейцарский стиль — минимум движения: всё, что движется само, выключается при prefers-reduced-motion.
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initPage() {
  pageTransitions();
  reveal();
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

/* Цитаты сменяются раз в interval мс. */
export function rotateQuotes(el, quotes, interval = 9000) {
  if (!el || !quotes.length) return;
  let i = Math.floor(Math.random() * quotes.length);
  el.innerHTML = '<div class="q-item" aria-live="polite"><q></q><cite></cite></div>';
  const item = el.querySelector(".q-item");
  const show = () => { item.querySelector("q").textContent = quotes[i][0]; item.querySelector("cite").textContent = quotes[i][1]; };
  show();
  if (reduceMotion || quotes.length < 2) return;
  setInterval(() => {
    if (document.hidden) return;
    item.classList.add("out");
    setTimeout(() => { i = (i + 1) % quotes.length; show(); item.classList.remove("out"); }, 500);
  }, interval);
}

/* Плавный уход со страницы перед переходом по внутренней ссылке. */
export function leave(url) {
  document.body.classList.add("leaving");
  setTimeout(() => { location.href = url; }, reduceMotion ? 0 : 200);
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
