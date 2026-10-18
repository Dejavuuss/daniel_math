// Переписка для всех кабинетов: написать любому участнику сайта (адресаты — из справочника directory),
// ветки по собеседникам, файлы, удаление (своих сообщений; репетитору — любых).
import { apiPost } from "./auth.js";
import { esc, fmtDate, byDate, fold, showToast, messageHtml, setTabCount } from "./ui.js";
import { createPicker, attach, attachmentsHtml, bindAttachments, filesFor } from "./files.js";

const ROLE_GROUP = { admin:"Репетитор", student:"Ученики", parent:"Родители" };

// opts: me (логин), isAdmin, getState() → данные apiGet, reload() — перезагрузить данные после изменений.
export function mountMessenger(box, opts) {
  if (!box) return { render() {} };
  box.innerHTML = `<form class="compose" novalidate>
      <label for="msg-to">Кому</label><select id="msg-to" name="to" required></select>
      <label for="msg-text">Сообщение</label><textarea id="msg-text" name="text" rows="3" maxlength="2000" required placeholder="Текст сообщения. Формулы — в знаках доллара: $x^2$"></textarea>
      <div data-attach></div>
      <div class="form-actions"><button class="primary" type="submit">Отправить</button></div>
    </form>
    <div class="threads"></div>`;
  const form = box.querySelector(".compose"), threads = box.querySelector(".threads");
  const picker = createPicker(form.querySelector("[data-attach]"));
  const state = () => opts.getState();
  const nameOf = u => ((state().directory || []).find(d => d.id === u) || state().users.find(x => x.username === u) || {}).name || u;
  const filesHtml = id => attachmentsHtml(filesFor(state().files, "message", id), { canDelete:f => opts.isAdmin || f.owner === opts.me });

  function fillRecipients() {
    const sel = form.to, keep = sel.value;
    const people = (state().directory || []).filter(d => d.id !== opts.me);
    sel.innerHTML = '<option value="">Выберите адресата</option>' + ["admin", "student", "parent"].map(role => {
      const list = people.filter(d => d.role === role).sort((a, b) => a.name.localeCompare(b.name, "ru"));
      return list.length ? `<optgroup label="${ROLE_GROUP[role]}">${list.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    if (keep && people.some(d => d.id === keep)) sel.value = keep;
  }

  // Ветка: собеседник (если я участвую) или пара «A и B» (переписка ребёнка у родителя, чужая — у репетитора).
  const threadOf = m => m.from === opts.me ? m.to : m.to === opts.me ? m.from : [m.from, m.to].sort().join("|");
  const titleOf = key => key.includes("|") ? key.split("|").map(nameOf).join(" и ") : nameOf(key);

  function render() {
    fillRecipients();
    const msgs = state().messages.slice().sort(byDate).reverse();
    if (!msgs.length) { threads.innerHTML = '<p class="empty-note">Сообщений пока нет. Выберите адресата и напишите первое.</p>'; return; }
    const groups = new Map();
    msgs.forEach(m => { const k = threadOf(m); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    threads.innerHTML = [...groups.entries()].map(([key, list]) => {
      const unread = list.filter(m => m.to === opts.me && !m.isRead).length;
      const canReply = !key.includes("|");
      const body = (canReply ? `<button type="button" class="ghost" data-reply="${esc(key)}">Ответить</button>` : "")
        + list.map(m => {
          const del = opts.isAdmin || m.from === opts.me
            ? `<button type="button" class="danger msg-del" data-del-msg="${esc(m.id)}" data-from="${esc(m.from)}">Удалить</button>` : "";
          return messageHtml(m, opts.me, nameOf, filesHtml(m.id) + del);
        }).join("");
      return fold("msg-" + key, esc(titleOf(key)), body, { count:list.length, note:unread ? `новых ${unread}` : "последнее " + fmtDate(list[0].date), open:unread > 0 });
    }).join("");
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!form.to.value) { showToast("Выберите, кому написать", true); return; }
    if (!form.text.value.trim()) { showToast("Напишите текст сообщения", true); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Отправляем…";
    let sent = false;
    try {
      const to = form.to.value;
      const res = await apiPost({ action:"addMessage", to, text:form.text.value });
      sent = true;
      if (picker.files().length) { btn.textContent = "Загружаем файлы…"; await attach("message", res.item.id, picker.files(), { from:opts.me, to }); }
      form.text.value = ""; picker.clear();
      await opts.reload();
      showToast("Сообщение отправлено");
    } catch (err) {
      showToast(sent ? "Сообщение отправлено, но файлы не загрузились: " + err.message : "Не удалось отправить: " + err.message, true);
      if (sent) await opts.reload();
    } finally { btn.disabled = false; btn.textContent = "Отправить"; }
  });

  threads.addEventListener("click", async e => {
    const reply = e.target.closest("[data-reply]");
    if (reply) { form.to.value = reply.dataset.reply; form.text.focus(); form.scrollIntoView({ block:"start", behavior:"smooth" }); return; }
    const del = e.target.closest("[data-del-msg]");
    if (!del || !confirm("Удалить сообщение? Вместе с ним удалятся прикреплённые файлы.")) return;
    del.disabled = true;
    try {
      await apiPost({ action:"deleteMessage", id:del.dataset.delMsg, from:del.dataset.from });
      await opts.reload();
      showToast("Сообщение удалено");
    } catch (err) { del.disabled = false; showToast("Не удалось удалить: " + err.message, true); }
  });
  bindAttachments(threads, () => state().files, opts.reload);
  return { render, nameOf };
}

// Число непрочитанных на кнопке раздела; при открытии раздела входящие отмечаются прочитанными.
export function trackUnread(tabId, opts) {
  const count = () => { const st = opts.getState(); return st ? st.messages.filter(m => m.to === opts.me && !m.isRead).length : 0; };
  const update = () => setTabCount(tabId, count());
  const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (btn) btn.addEventListener("click", async () => {
    const st = opts.getState();
    if (!st || !count()) return;
    try {
      await apiPost({ action:"markMessagesRead" });
      st.messages.forEach(m => { if (m.to === opts.me) m.isRead = true; });
      update();
      if (opts.onRead) opts.onRead();
    } catch (_) {}
  });
  return update;
}
