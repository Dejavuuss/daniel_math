// «Смотритель» — чат-ассистент для всех посетителей. Говорит с Cloud Function (functions/index.js),
// которая хранит ключ OpenRouter API и лимиты. Диалог живёт в sessionStorage вкладки, чтобы не теряться
// при переходе между страницами; на сервер уходят последние реплики (сервер обрезает историю сам).
import { ASSISTANT_URL } from "./firebase-config.js";
import { reduceMotion } from "./fx.js";

const STORE_KEY = "tutor_assistant";
const HISTORY_LIMIT = 12;
const GREETING = "Здравствуйте! Я Смотритель этого музея и помощник репетитора. Спросите о занятиях, ценах и записи — или о задаче, которая не даётся.";
const SUGGESTIONS = ["Сколько стоит занятие?", "Как записаться?", "Помогите с задачей"];

export function mountAssistant() {
  if (!ASSISTANT_URL || document.querySelector(".assistant")) return;
  let history = load();
  let busy = false;

  const root = document.createElement("div");
  root.className = "assistant";
  root.innerHTML = `
    <section class="assistant-panel" id="assistantPanel" role="dialog" aria-label="Смотритель — ассистент сайта" hidden>
      <header class="assistant-head">
        <div class="seal" aria-hidden="true">?</div>
        <div><strong>Смотритель</strong><span>Отвечает ИИ — может ошибаться</span></div>
        <button class="icon-btn assistant-close" type="button" aria-label="Закрыть чат">✕</button>
      </header>
      <div class="assistant-log" role="log" aria-live="polite"></div>
      <div class="assistant-chips"></div>
      <form class="assistant-form">
        <textarea rows="1" maxlength="1000" placeholder="Ваш вопрос…" aria-label="Ваш вопрос"></textarea>
        <button class="primary icon-btn" type="submit" aria-label="Отправить"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </form>
    </section>
    <button class="assistant-toggle" type="button" aria-expanded="false" aria-controls="assistantPanel">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8.5" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/><circle cx="15.5" cy="11" r="1" fill="currentColor"/></svg>
      <span>Смотритель</span>
    </button>`;
  document.body.appendChild(root);
  document.body.classList.add("has-assistant");

  const panel = root.querySelector(".assistant-panel");
  const toggle = root.querySelector(".assistant-toggle");
  const log = root.querySelector(".assistant-log");
  const chips = root.querySelector(".assistant-chips");
  const form = root.querySelector(".assistant-form");
  const input = form.querySelector("textarea");
  const send = form.querySelector("button");

  const bubble = (role, text, extra = "") => {
    const el = document.createElement("div");
    el.className = `assistant-msg ${role === "user" ? "me" : "bot"}${extra}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };
  const render = () => {
    log.innerHTML = "";
    bubble("assistant", GREETING);
    history.forEach(m => bubble(m.role, m.content));
    chips.hidden = history.length > 0;
  };
  chips.innerHTML = SUGGESTIONS.map(s => `<button type="button">${s}</button>`).join("");
  chips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => ask(b.textContent)));

  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    root.classList.toggle("open", open);
    if (open) { render(); setTimeout(() => input.focus(), reduceMotion ? 0 : 200); }
    else toggle.focus();
  };
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  root.querySelector(".assistant-close").addEventListener("click", () => setOpen(false));
  root.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });

  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", e => { e.preventDefault(); ask(input.value); });

  async function ask(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true; send.disabled = true; chips.hidden = true;
    input.value = ""; grow();
    history.push({ role:"user", content:text });
    bubble("user", text);
    const typing = bubble("assistant", "", " typing");
    typing.setAttribute("aria-label", "Смотритель печатает");
    try {
      const res = await fetch(ASSISTANT_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ messages:history.slice(-HISTORY_LIMIT) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || "Ассистент временно недоступен. Попробуйте позже.");
      history.push({ role:"assistant", content:data.reply });
      typing.remove();
      bubble("assistant", data.reply, " fresh");
      save(history);
    } catch (err) {
      // Неудачный вопрос убираем из истории и возвращаем в поле ввода, чтобы можно было повторить.
      history.pop();
      typing.remove();
      log.lastElementChild && log.lastElementChild.classList.contains("me") && log.lastElementChild.remove();
      bubble("assistant", err instanceof TypeError ? "Нет связи с сервером. Проверьте интернет." : err.message, " error");
      input.value = text; grow();
    } finally {
      busy = false; send.disabled = false; input.focus();
    }
  }
}

function load() {
  try {
    const list = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(list) ? list.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
  } catch (_) { return []; }
}
function save(list) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-40))); } catch (_) {}
}

mountAssistant();
