// URL веб-приложения Apps Script. Замените на URL своего деплоя /exec.
const APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycbxrRaAt71giRUcmyNJxu62TLoGPHOaQPx4BkCEqeso_r-kXDVc_liqggeFdwROAdoJ5/exec
const USER_KEY = "tutor_user";
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (_) { return null; }
}
function saveCurrentUser(user, token) {
  localStorage.setItem(USER_KEY, JSON.stringify({ username:user.username, name:user.name, role:user.role, grade:user.grade, token:token }));
}
function logout() { localStorage.removeItem(USER_KEY); location.href = "index.html"; }
function requireAuth(role) {
  const user = getCurrentUser();
  if (!user || (role && user.role !== role)) { location.replace("index.html"); return null; }
  return user;
}
async function apiGet() {
  const user = getCurrentUser();
  if (!user || !user.token) throw new Error("Войдите в систему заново.");
  const query = new URLSearchParams({ _: String(Date.now()), username: user.username, token: user.token });
  const res = await fetch(APPS_SCRIPT_URL + "?" + query.toString(), { method:"GET", cache:"no-store" });
  if (!res.ok) throw new Error("Ошибка загрузки данных (" + res.status + ")");
  const data = await res.json();
  if (data.ok === false) throw new Error(data.error || "Ошибка сервера");
  return data;
}
async function apiPost(payload) {
  const user = getCurrentUser();
  const body = Object.assign({}, payload);
  if (payload.action !== "login" && user) { body.username = user.username; body.token = user.token; }
  const res = await fetch(APPS_SCRIPT_URL, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "Ошибка запроса");
  return data;
}
function initTheme() {
  const saved = localStorage.getItem("tutor_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next); localStorage.setItem("tutor_theme", next);
  });
}
initTheme();