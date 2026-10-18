// Кнопка «Сменить пароль» в шапке кабинета: каждый пользователь меняет свой пароль сам.
// (Чужой пароль сайт сменить не может — это делается в Firebase Console → Authentication.)
import { apiPost } from "./auth.js";
import { showToast } from "./ui.js";

export function mountPasswordButton() {
  const actions = document.querySelector(".topbar .actions");
  if (!actions || document.getElementById("passwordBtn")) return;
  const btn = document.createElement("button");
  btn.id = "passwordBtn";
  btn.className = "icon-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Сменить пароль");
  btn.title = "Сменить пароль";
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" fill="none" stroke="currentColor"/><path d="M11 12.5 20 4M16.5 7.5l2.5 2.5M14 10l2 2" fill="none" stroke="currentColor"/></svg>';
  actions.insertBefore(btn, document.getElementById("logoutBtn"));

  const dlg = document.createElement("dialog");
  dlg.className = "dialog";
  dlg.innerHTML = `<form method="dialog" class="dialog-form" novalidate>
    <h3>Сменить пароль</h3>
    <label for="pw-old">Текущий пароль</label><input id="pw-old" name="old" type="password" autocomplete="current-password" required>
    <label for="pw-new">Новый пароль (от 6 символов)</label><input id="pw-new" name="next" type="password" autocomplete="new-password" minlength="6" required>
    <label for="pw-rep">Повторите новый пароль</label><input id="pw-rep" name="repeat" type="password" autocomplete="new-password" required>
    <p class="error" role="alert"></p>
    <div class="form-actions"><button type="button" data-close>Отмена</button><button class="primary" type="submit">Сохранить</button></div>
  </form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector("form"), err = dlg.querySelector(".error");
  btn.onclick = () => { form.reset(); err.textContent = ""; dlg.showModal(); };
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.textContent = "";
    if (form.next.value !== form.repeat.value) { err.textContent = "Новые пароли не совпадают."; return; }
    const save = form.querySelector('button[type="submit"]');
    save.disabled = true; save.textContent = "Сохраняем…";
    try {
      await apiPost({ action:"changePassword", oldPassword:form.old.value, newPassword:form.next.value });
      dlg.close();
      showToast("Пароль изменён");
    } catch (ex) { err.textContent = ex.message; }
    finally { save.disabled = false; save.textContent = "Сохранить"; }
  });
}
