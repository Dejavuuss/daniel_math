const session = requireAuth("admin");

const FILES = ["materials", "homework", "schedule", "users"];
const store = {};

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const draftKey = n => "tutor_draft_" + n;

function persist(name) {
  localStorage.setItem(draftKey(name), JSON.stringify(store[name]));
}

function nextId(list) {
  return list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}

function download(name) {
  const blob = new Blob([JSON.stringify(store[name], null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function students() {
  return store.users.filter(u => u.role === "student");
}

function fillStudentSelects() {
  const opts = students().map(u => `<option value="${esc(u.login)}">${esc(u.name)} (${esc(u.login)})</option>`).join("");
  document.getElementById("studentSelect").innerHTML = opts;
  document.getElementById("eventStudent").innerHTML = `<option value="">Все</option>` + opts;
}

function table(name, cols, rows) {
  if (!rows.length) return `<p class="muted">Записей нет.</p>`;
  return `<div style="overflow-x:auto"><table>
    <tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr>
    ${rows.map((r, i) => `<tr>${cols.map(c => `<td>${esc(r[c[0]])}</td>`).join("")}
      <td><button class="danger" data-del="${name}" data-i="${i}">✕</button></td></tr>`).join("")}
  </table></div>`;
}

function renderLists() {
  document.getElementById("l-materials").innerHTML = table("materials",
    [["title", "Название"], ["grade", "Класс"], ["url", "Ссылка"]], store.materials);
  document.getElementById("l-homework").innerHTML = table("homework",
    [["student", "Ученик"], ["title", "Задание"], ["assigned", "Выдано"], ["due", "Дедлайн"], ["status", "Статус"]], store.homework);
  document.getElementById("l-schedule").innerHTML = table("schedule",
    [["date", "Дата"], ["time", "Время"], ["type", "Тип"], ["title", "Описание"], ["student", "Ученик"]],
    store.schedule);
  document.getElementById("l-users").innerHTML = table("users",
    [["login", "Логин"], ["name", "Имя"], ["role", "Роль"], ["grade", "Класс"]], store.users);

  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const name = b.dataset.del;
    const item = store[name][+b.dataset.i];
    if (name === "users" && item.role === "admin") { alert("Админа удалять нельзя."); return; }
    if (!confirm("Удалить запись?")) return;
    store[name].splice(+b.dataset.i, 1);
    persist(name);
    fillStudentSelects();
    renderLists();
  });
}

function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = v; });
  return o;
}

function bindForms() {
  document.getElementById("f-materials").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    const item = { id: nextId(store.materials), title: d.title, url: d.url, description: d.description };
    if (d.grade) item.grade = +d.grade;
    store.materials.push(item);
    persist("materials"); e.target.reset(); renderLists();
  };

  document.getElementById("f-homework").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    store.homework.push({ id: nextId(store.homework), student: d.student, title: d.title, assigned: d.assigned, due: d.due, status: "pending" });
    persist("homework"); e.target.reset(); renderLists();
  };

  document.getElementById("f-schedule").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    const item = { date: d.date, time: d.time, type: d.type, title: d.title };
    if (d.student) item.student = d.student;
    store.schedule.push(item);
    store.schedule.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    persist("schedule"); e.target.reset(); renderLists();
  };

  document.getElementById("f-users").onsubmit = async e => {
    e.preventDefault();
    const d = formData(e.target);
    if (store.users.some(u => u.login.toLowerCase() === d.login.toLowerCase())) { alert("Такой логин уже есть."); return; }
    const user = { login: d.login, name: d.name, role: "student", grade: +d.grade };
    if (d.hash) user.passwordHash = await sha256(d.password); else user.password = d.password;
    // порядок полей: login, password/passwordHash, name, ...
    store.users.push(user);
    persist("users"); e.target.reset(); fillStudentSelects(); renderLists();
  };

  document.querySelectorAll("[data-download]").forEach(b => b.onclick = () => download(b.dataset.download));
}

/* ---------- GitHub API ---------- */
function bindGithub() {
  const repo = document.getElementById("ghRepo"), branch = document.getElementById("ghBranch"), token = document.getElementById("ghToken");
  const status = document.getElementById("ghStatus");
  repo.value = localStorage.getItem("tutor_gh_repo") || "";
  branch.value = localStorage.getItem("tutor_gh_branch") || "main";
  token.value = localStorage.getItem("tutor_gh_token") || "";

  document.getElementById("ghSave").onclick = () => {
    localStorage.setItem("tutor_gh_repo", repo.value.trim());
    localStorage.setItem("tutor_gh_branch", branch.value.trim());
    localStorage.setItem("tutor_gh_token", token.value.trim());
    status.textContent = "Настройки сохранены в этом браузере.";
  };

  document.getElementById("ghPush").onclick = async () => {
    if (!repo.value || !token.value) { status.textContent = "Укажите репозиторий и токен."; return; }
    if (!confirm("Перезаписать data/*.json в репозитории текущим содержимым?")) return;
    status.textContent = "Отправляю…";
    try {
      for (const name of FILES) {
        const url = `https://api.github.com/repos/${repo.value.trim()}/contents/data/${name}.json`;
        const headers = { Authorization: "Bearer " + token.value.trim(), Accept: "application/vnd.github+json" };
        const cur = await fetch(url + "?ref=" + encodeURIComponent(branch.value), { headers });
        const sha = cur.ok ? (await cur.json()).sha : undefined;
        const text = JSON.stringify(store[name], null, 2) + "\n";
        const content = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
        const res = await fetch(url, {
          method: "PUT", headers,
          body: JSON.stringify({ message: `Обновление ${name}.json из панели репетитора`, content, sha, branch: branch.value.trim() })
        });
        if (!res.ok) throw new Error(`${name}.json: ${res.status} ${(await res.json()).message || ""}`);
      }
      status.textContent = "Готово! Страницы обновятся через минуту-две.";
    } catch (e) {
      status.textContent = "Ошибка: " + e.message;
    }
  };
}

(async function init() {
  if (!session) return;
  document.getElementById("logoutBtn").onclick = logout;

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
    };
  });

  try {
    for (const name of FILES) {
      const draft = localStorage.getItem(draftKey(name));
      store[name] = draft ? JSON.parse(draft) : await loadJSON(`data/${name}.json`);
    }
  } catch (e) {
    alert(e.message);
    return;
  }
  fillStudentSelects();
  bindForms();
  bindGithub();
  renderLists();
})();
