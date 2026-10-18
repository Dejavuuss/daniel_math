// Прикреплённые файлы: поле выбора (кнопка, перетаскивание, вставка скриншота Ctrl+V),
// сжатие фото в браузере, миниатюры, просмотр фото и скачивание.
// Хранение — в js/auth.js (attachFiles / downloadFile / deleteFile).
import { apiPost, downloadFile, FILE_LIMITS } from "./auth.js";
import { esc, showToast } from "./ui.js";

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.odt,.ods,.odp,.rtf,.zip";
const IMAGE_RE = /^image\/(jpeg|png|webp|bmp)$/;

export const isImage = f => /^image\//.test(f.type || "") && !!f.thumb;
export const filesFor = (all, kind, parentId) => (all || []).filter(f => f.kind === kind && String(f.parentId) === String(parentId));
export function fmtSize(n) {
  return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " КБ" : (n / 1024 / 1024).toFixed(1).replace(".", ",") + " МБ";
}

/* ---------- Подготовка: сжатие фото и миниатюра ---------- */

function drawScaled(bmp, max, type, quality) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext("2d");
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, type, quality));
}
const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

// Скриншот из буфера обмена приходит как «image.png» — даём понятное имя.
function screenshotName(file) {
  if (!/^image\.(png|jpe?g)$/i.test(file.name || "")) return file;
  const t = new Date(), hm = `${String(t.getHours()).padStart(2, "0")}-${String(t.getMinutes()).padStart(2, "0")}`;
  return new File([file], `скриншот ${hm}.${file.name.split(".").pop()}`, { type:file.type });
}

async function prepareOne(file) {
  let blob = file, type = file.type || "", name = file.name || "файл";
  let thumb = "";
  if (IMAGE_RE.test(type)) {
    const bmp = await createImageBitmap(file);
    // Большие фото с телефона уменьшаем до 1920 px — текст и чертежи остаются читаемыми.
    if (Math.max(bmp.width, bmp.height) > 1920 || file.size > 1.5 * 1024 * 1024) {
      blob = await drawScaled(bmp, 1920, "image/jpeg", 0.85);
      type = "image/jpeg";
      name = name.replace(/\.[^.]+$/, "") + ".jpg";
    }
    for (const size of [240, 160]) {
      thumb = await toDataUrl(await drawScaled(bmp, size, "image/jpeg", 0.65));
      if (thumb.length <= 40000) break;
      thumb = "";
    }
    bmp.close();
  }
  if (blob.size > FILE_LIMITS.maxSize) throw new Error(`Файл «${name}» больше 5 МБ — сожмите его или разделите на части.`);
  return { name, type, data:new Uint8Array(await blob.arrayBuffer()), thumb };
}

export async function prepareFiles(list) {
  const files = [...list];
  if (files.length > FILE_LIMITS.maxCount) throw new Error(`Можно прикрепить не больше ${FILE_LIMITS.maxCount} файлов за раз.`);
  const out = [];
  for (const f of files) out.push(await prepareOne(f));
  return out;
}

// Прикрепить выбранные файлы к записи. extra — {student} для ДЗ, {from, to} для сообщений.
export async function attach(kind, parentId, files, extra = {}) {
  if (!files.length) return [];
  const prepared = await prepareFiles(files);
  return (await apiPost(Object.assign({ action:"attachFiles", kind, parentId, files:prepared }, extra))).items;
}

/* ---------- Поле выбора файлов ---------- */

// host — пустой контейнер внутри формы. Возвращает { files(), clear() }.
export function createPicker(host) {
  let picked = [];
  host.classList.add("attach");
  host.innerHTML = `
    <label class="attach-drop">
      <input type="file" multiple accept="${ACCEPT}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span><b>Прикрепить файлы</b><small>фото, PDF, документы до 5 МБ — можно перетащить сюда или вставить скриншот Ctrl+V</small></span>
    </label>
    <ul class="attach-list"></ul>`;
  const input = host.querySelector("input"), list = host.querySelector(".attach-list"), drop = host.querySelector(".attach-drop");

  const render = () => {
    list.querySelectorAll("img").forEach(img => URL.revokeObjectURL(img.src));
    list.innerHTML = picked.map((f, i) => `<li>
      ${IMAGE_RE.test(f.type) ? `<img src="${URL.createObjectURL(f)}" alt="">` : `<span class="att-ext">${esc(ext(f.name))}</span>`}
      <span class="att-name">${esc(f.name || "скриншот")}</span><span class="att-size">${fmtSize(f.size)}</span>
      <button type="button" class="att-del" data-i="${i}" aria-label="Убрать файл">✕</button></li>`).join("");
    list.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { picked.splice(+b.dataset.i, 1); render(); });
  };
  const add = files => {
    const incoming = [...files].filter(f => f && f.size);
    if (picked.length + incoming.length > FILE_LIMITS.maxCount) showToast(`Не больше ${FILE_LIMITS.maxCount} файлов за раз.`, true);
    picked = picked.concat(incoming).slice(0, FILE_LIMITS.maxCount);
    render();
  };
  input.addEventListener("change", () => { add(input.files); input.value = ""; });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); });
  // Скриншот из буфера обмена: Ctrl+V в любом поле этой формы.
  const form = host.closest("form") || host;
  form.addEventListener("paste", e => {
    const files = [...(e.clipboardData && e.clipboardData.files || [])].map(screenshotName);
    if (files.length) { e.preventDefault(); add(files); showToast("Скриншот добавлен"); }
  });
  return { files:() => picked.slice(), clear:() => { picked = []; render(); } };
}

/* ---------- Решение ДЗ от ученика или родителя ---------- */

// На телефоне выбор файла сразу предлагает камеру — удобно сфотографировать тетрадь.
export const solutionButtonHtml = id => `<label class="btn attach-solution"><input type="file" multiple accept="${ACCEPT}" data-solution="${esc(id)}">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <span>Прикрепить решение</span></label>`;

export function bindSolutionUploads(root, student, onDone) {
  if (!root || root.dataset.solBound) return;
  root.dataset.solBound = "1";
  root.addEventListener("change", async e => {
    const input = e.target.closest("[data-solution]");
    if (!input || !input.files.length) return;
    const label = input.closest("label"), text = label.querySelector("span"), old = text.textContent;
    label.classList.add("busy"); text.textContent = "Загружаем…";
    try {
      await attach("homework", input.dataset.solution, input.files, { student });
      showToast("Решение прикреплено");
      onDone && onDone();
    } catch (err) { showToast("Не удалось загрузить: " + err.message, true); }
    finally { input.value = ""; label.classList.remove("busy"); text.textContent = old; }
  });
}

/* ---------- Показ прикреплённых файлов ---------- */

const ext = name => (String(name).split(".").pop() || "файл").slice(0, 4).toUpperCase();

// opts.canDelete(f) — показывать ли крестик; opts.note(f) — подпись (например, «решение ученика»).
export function attachmentsHtml(list, opts = {}) {
  if (!list || !list.length) return "";
  const canDelete = opts.canDelete || (() => false);
  return `<div class="attachments">${list.map(f => `<div class="att-item${isImage(f) ? " is-img" : ""}">
      ${isImage(f)
        ? `<button type="button" class="att-img" data-file="${esc(f.id)}" title="${esc(f.name)}"><img src="${esc(f.thumb)}" alt="${esc(f.name)}" loading="lazy"></button>`
        : `<button type="button" class="att-file" data-file="${esc(f.id)}" title="Скачать"><span class="att-ext">${esc(ext(f.name))}</span><span class="att-name">${esc(f.name)}</span><span class="att-size">${fmtSize(f.size)}</span></button>`}
      ${opts.note && opts.note(f) ? `<span class="att-note">${esc(opts.note(f))}</span>` : ""}
      ${canDelete(f) ? `<button type="button" class="att-del" data-file-del="${esc(f.id)}" aria-label="Удалить файл ${esc(f.name)}">✕</button>` : ""}
    </div>`).join("")}</div>`;
}

// Один обработчик на контейнер: открыть фото, скачать файл, удалить. getFiles() — актуальный список.
export function bindAttachments(root, getFiles, onDeleted) {
  if (!root || root.dataset.attBound) return;
  root.dataset.attBound = "1";
  root.addEventListener("click", async e => {
    const open = e.target.closest("[data-file]"), del = e.target.closest("[data-file-del]");
    if (!open && !del) return;
    const id = del ? del.dataset.fileDel : open.dataset.file;
    const f = getFiles().find(x => x.id === id);
    if (!f) return;
    e.preventDefault();
    if (del) {
      if (!confirm(`Удалить файл «${f.name}»?`)) return;
      del.disabled = true;
      try { await apiPost({ action:"deleteFile", id:f.id, chunks:f.chunks, owner:f.owner }); showToast("Файл удалён"); onDeleted && onDeleted(f); }
      catch (err) { del.disabled = false; showToast("Не удалось удалить: " + err.message, true); }
      return;
    }
    if (isImage(f)) return openViewer(f);
    open.classList.add("loading");
    try { saveBlob(await downloadFile(f), f.name); }
    catch (err) { showToast("Не удалось скачать: " + err.message, true); }
    finally { open.classList.remove("loading"); }
  });
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href:url, download:name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Просмотр фото: сразу показываем миниатюру, затем подменяем полной версией.
async function openViewer(f) {
  const box = document.createElement("div");
  box.className = "viewer";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", f.name);
  box.innerHTML = `<figure><img src="${esc(f.thumb)}" alt="${esc(f.name)}" class="blur"><figcaption><span>${esc(f.name)}</span>
    <button type="button" class="viewer-save">Скачать</button><button type="button" class="icon-btn viewer-close" aria-label="Закрыть">✕</button></figcaption></figure>`;
  document.body.appendChild(box);
  const img = box.querySelector("img");
  let blob = null, url = "";
  const close = () => { box.remove(); if (url) URL.revokeObjectURL(url); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  box.addEventListener("click", e => { if (e.target === box || e.target.closest(".viewer-close")) close(); });
  box.querySelector(".viewer-close").focus();
  box.querySelector(".viewer-save").onclick = () => blob && saveBlob(blob, f.name);
  try {
    blob = await downloadFile(f);
    url = URL.createObjectURL(blob);
    img.src = url; img.classList.remove("blur");
  } catch (err) { showToast("Не удалось открыть: " + err.message, true); close(); }
}
