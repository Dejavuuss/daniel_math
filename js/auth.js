/* Простая клиентская "авторизация".
   ВАЖНО: это не настоящая защита, а разграничение доступа для удобства. См. README. */

const SESSION_KEY = "tutor_session";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function loadJSON(path) {
  const res = await fetch(path + "?t=" + Date.now());
  if (!res.ok) throw new Error("Не удалось загрузить " + path);
  return res.json();
}

function saveSession(user, remember) {
  const data = JSON.stringify({ login: user.login, name: user.name, role: user.role, grade: user.grade || null });
  // «Запомнить меня» -> localStorage, иначе sessionStorage (до закрытия вкладки)
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, data);
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  location.href = "index.html";
}

// Проверка пароля: поддерживаются и открытый "password", и "passwordHash" (SHA-256)
async function checkPassword(user, password) {
  if (user.passwordHash) return (await sha256(password)) === user.passwordHash.toLowerCase();
  return user.password === password;
}

async function login(loginName, password, remember) {
  const users = await loadJSON("data/users.json");
  const user = users.find(u => u.login.toLowerCase() === loginName.trim().toLowerCase());
  if (!user || !(await checkPassword(user, password))) return null;
  saveSession(user, remember);
  return user;
}

// Вызывать на защищённых страницах. role: необязательно, например "admin"
function requireAuth(role) {
  const s = getSession();
  if (!s || (role && s.role !== role)) {
    location.href = "index.html";
    return null;
  }
  return s;
}

// Тёмная тема
function initTheme() {
  const saved = localStorage.getItem("tutor_theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tutor_theme", next);
  });
}
initTheme();

// Форма входа (index.html)
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  if (getSession()) {
    const s = getSession();
    location.href = s.role === "admin" ? "admin.html" : "dashboard.html";
  }
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("loginError");
    err.textContent = "";
    try {
      const user = await login(
        document.getElementById("loginName").value,
        document.getElementById("password").value,
        document.getElementById("remember").checked
      );
      if (!user) { err.textContent = "Неверное имя или пароль"; return; }
      location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
    } catch (ex) {
      err.textContent = "Ошибка: " + ex.message + ". Откройте сайт через GitHub Pages или локальный сервер.";
    }
  });
}
