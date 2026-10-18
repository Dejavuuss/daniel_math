// Формулы как в учебнике: $\frac{1}{2}$ — в строке, $$x^2 + y^2 = r^2$$ — отдельной строкой.
// KaTeX грузится с CDN только когда на странице впервые встречается формула.
// autoTypeset(root) следит за содержимым и отрисовывает формулы во всём, что появляется позже.
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.18.11/";
const HAS_MATH = /\$[^$\n]+\$|\\\(|\\\[/;
const OPTIONS = {
  delimiters:[
    { left:"$$", right:"$$", display:true },
    { left:"$", right:"$", display:false },
    { left:"\\(", right:"\\)", display:false },
    { left:"\\[", right:"\\]", display:true }
  ],
  throwOnError:false,
  ignoredTags:["script", "noscript", "style", "textarea", "pre", "code", "option", "input", "select"],
  ignoredClasses:["no-math"]
};

let loading = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src, async:true, crossOrigin:"anonymous" });
    s.onload = resolve; s.onerror = () => reject(new Error("Не удалось загрузить формулы"));
    document.head.appendChild(s);
  });
}
function loadKatex() {
  if (!loading) {
    loading = (async () => {
      document.head.appendChild(Object.assign(document.createElement("link"), { rel:"stylesheet", href:CDN + "katex.min.css", crossOrigin:"anonymous" }));
      await loadScript(CDN + "katex.min.js");
      await loadScript(CDN + "contrib/auto-render.min.js");
      return window.renderMathInElement;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export function typeset(el) {
  if (!el || !HAS_MATH.test(el.textContent)) return Promise.resolve();
  return loadKatex().then(render => render(el, OPTIONS)).catch(() => {});
}

export function autoTypeset(root = document.querySelector("main")) {
  if (!root) return;
  typeset(root);
  // Реагируем только на появление текста с формулой (а не, например, на анимацию чисел) и сразу, в следующем кадре.
  let pending = false;
  new MutationObserver(records => {
    if (pending || !records.some(r => [...r.addedNodes].some(n => HAS_MATH.test(n.textContent || "")))) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; typeset(root); });
  }).observe(root, { childList:true, subtree:true });
}

// Живой предпросмотр формул под полем ввода (появляется, только если в тексте есть формула).
export function mathPreview(input, out) {
  let timer = 0;
  const update = () => {
    out.hidden = !HAS_MATH.test(input.value);
    if (out.hidden) return;
    out.textContent = input.value;
    typeset(out);
  };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 250); });
  input.form && input.form.addEventListener("reset", () => setTimeout(update));
  update();
}

export const MATH_HINT = "Формулы: $x^2$, $\\frac{1}{2}$, $\\sqrt{x}$, $\\pi$ — в знаках доллара";
