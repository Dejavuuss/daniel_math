// Слой данных кабинета: Firebase Auth + Cloud Firestore (или демо-данные, пока не заполнен js/firebase-config.js).
// Страницы обращаются к бэкенду только через login / apiGet / apiPost — контракт тот же, что был у Apps Script:
// apiGet() возвращает весь доступный роли набор данных, apiPost({action, ...}) выполняет одно действие.
// Права проверяются на сервере правилами firestore.rules; проверки здесь — только для понятных сообщений об ошибках.
import { firebaseConfig, USERNAME_DOMAIN } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const USER_KEY = "tutor_user";
const THEME_KEY = "tutor_theme";
export const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_");

export const COLLECTIONS = ["users","materials","homework","schedule","grades","lessonNotes","payments","achievements","messages","topics"];
const DELETABLE = COLLECTIONS.filter(c => c !== "users");
const SUBJECTS = ["Математика","Алгебра","Геометрия"];

/* ---------- Сессия ---------- */

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (_) { return null; }
}
function saveCurrentUser(u) {
  localStorage.setItem(USER_KEY, JSON.stringify({ username:u.username, name:u.name, role:u.role, grade:u.grade, child:u.child || "" }));
}
export function homeFor(role) {
  return role === "admin" ? "admin.html" : role === "parent" ? "parent.html" : "dashboard.html";
}

export async function login(username, password) {
  username = String(username || "").trim().toLowerCase();
  if (!username || !password) throw new Error("Введите логин и пароль.");
  try {
    const user = await (await backend()).login(username, String(password));
    saveCurrentUser(user);
    return user;
  } catch (e) { throw humanError(e); }
}

export async function logout() {
  localStorage.removeItem(USER_KEY);
  try { await (await backend()).logout(); } catch (_) {}
  location.href = "index.html";
}

// Профиль в localStorage — только кэш для мгновенной отрисовки; саму сессию проверяет Firebase.
export function requireAuth(role) {
  const user = getCurrentUser();
  if (!user || (role && user.role !== role)) { location.replace("index.html"); return null; }
  backend().then(b => b.hasSession()).then(ok => {
    if (!ok) { localStorage.removeItem(USER_KEY); location.replace("index.html"); }
  }).catch(() => {});
  return user;
}

/* ---------- API ---------- */

export async function apiGet() {
  const user = getCurrentUser();
  if (!user) throw new Error("Войдите в систему заново.");
  try { return await (await backend()).load(user); } catch (e) { throw humanError(e); }
}

export async function apiPost(payload) {
  const user = getCurrentUser();
  if (!user) throw new Error("Войдите в систему заново.");
  try { return await dispatch(await backend(), user, payload || {}); } catch (e) { throw humanError(e); }
}

// Действия администратора, которые просто добавляют запись: action → [коллекция, проверенная запись].
const ADMIN_RECORDS = {
  addMaterial: p => ["materials", {
    title:required(p.title,"Название",200), grade:optionalInt(p.grade,1,11,"Класс"), url:optionalUrl(p.url),
    description:text(p.description,2000), topic:text(p.topic,200), type:oneOf(p.type || "material",["material","video","test","worksheet"],"Тип")
  }],
  addHomework: p => ["homework", {
    student:required(p.student,"Ученик",40), title:required(p.title,"Задание",300), assigned:date(p.assigned,"Дата выдачи"),
    due:date(p.due,"Срок сдачи"), status:"pending", link:optionalUrl(p.link), comment:text(p.comment,2000)
  }],
  addEvent: p => ["schedule", {
    date:date(p.date,"Дата"), time:time(p.time), type:oneOf(p.type,["lesson","deadline","test","olympiad"],"Тип"),
    title:required(p.title,"Название",200), description:text(p.description,2000), student:text(p.student,40),
    status:oneOf(p.status || "planned",["planned","done","cancelled"],"Статус")
  }],
  addGrade: p => ["grades", {
    student:required(p.student,"Ученик",40), subject:oneOf(p.subject,SUBJECTS,"Предмет"),
    grade:int(p.grade,1,5,"Оценка должна быть от 1 до 5."), date:date(p.date,"Дата"), comment:text(p.comment,500)
  }],
  addLessonNote: p => ["lessonNotes", {
    date:date(p.date,"Дата"), student:required(p.student,"Ученик",40), topic:required(p.topic,"Тема",200), note:text(p.note,5000),
    rating:int(p.rating || 0,0,5,"Усвоение: число от 0 до 5."), duration:int(p.duration || 60,1,600,"Длительность: от 1 до 600 минут.")
  }],
  addPayment: p => ["payments", {
    date:date(p.date,"Дата"), student:required(p.student,"Ученик",40), amount:amount(p.amount),
    type:oneOf(p.type,["paid","lesson","refund"],"Тип"), description:text(p.description,500)
  }],
  addAchievement: p => ["achievements", {
    student:required(p.student,"Ученик",40), title:required(p.title,"Название",120), description:text(p.description,500),
    date:date(p.date,"Дата"), icon:text(p.icon || "🏆",16)
  }],
  addTopic: p => ["topics", {
    subject:oneOf(p.subject,SUBJECTS,"Предмет"), title:required(p.title,"Название",200), description:text(p.description,2000)
  }]
};

async function dispatch(b, user, p) {
  const action = String(p.action || "");
  const isAdmin = user.role === "admin";
  const needAdmin = () => { if (!isAdmin) throw new Error("Недостаточно прав: требуется администратор."); };

  if (ADMIN_RECORDS[action]) {
    needAdmin();
    const [name, data] = ADMIN_RECORDS[action](p);
    const id = await b.add(name, data);
    return { ok:true, item:Object.assign({ id }, data) };
  }
  switch (action) {
    case "updateHomeworkStatus": {
      const id = String(p.homeworkId == null ? "" : p.homeworkId), status = String(p.status || "");
      if (!id || !["pending","done"].includes(status)) throw new Error("Некорректный ID или статус.");
      await b.update("homework", id, { status });
      return { ok:true, homeworkId:id, status };
    }
    case "addMessage": {
      const data = { from:user.username, to:required(p.to,"Получатель",40), text:required(p.text,"Сообщение",2000), date:today(), isRead:false };
      const id = await b.add("messages", data);
      return { ok:true, item:Object.assign({ id }, data) };
    }
    case "markMessagesRead":
      return { ok:true, count:await b.markRead(user) };
    case "deleteRow": {
      needAdmin();
      const name = String(p.sheet || ""), id = String(p.id == null ? "" : p.id);
      if (!DELETABLE.includes(name) || !id) throw new Error("Некорректная запись для удаления.");
      await b.remove(name, id);
      return { ok:true };
    }
    case "addStudent":
    case "addParent": {
      needAdmin();
      const role = action === "addStudent" ? "student" : "parent";
      const profile = {
        username:username(p.username),
        name:required(p.name, role === "parent" ? "Имя родителя" : "Имя ученика", 100),
        role,
        grade:role === "student" ? optionalInt(p.grade,1,11,"Класс") : null,
        child:role === "parent" ? required(p.child,"Ученик",40) : ""
      };
      const password = String(p.password || "");
      if (password.length < 6) throw new Error("Пароль должен содержать не менее 6 символов.");
      return { ok:true, item:await b.createUser(profile, password) };
    }
    default:
      throw new Error("Неизвестное действие: " + action);
  }
}

/* ---------- Проверка полей ---------- */

function required(v, label, max) {
  const s = String(v == null ? "" : v).trim();
  if (!s) throw new Error(`Заполните поле: ${label}.`);
  if (s.length > max) throw new Error(`Поле «${label}» длиннее ${max} символов.`);
  return s;
}
function text(v, max) {
  const s = String(v == null ? "" : v).trim();
  if (s.length > max) throw new Error(`Текст длиннее ${max} символов.`);
  return s;
}
function date(v, label) {
  const s = required(v, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Поле «${label}»: дата в формате ГГГГ-ММ-ДД.`);
  return s;
}
function time(v) {
  const s = text(v, 5);
  if (s && !/^\d{2}:\d{2}$/.test(s)) throw new Error("Время в формате ЧЧ:ММ.");
  return s;
}
function optionalUrl(v) {
  const s = text(v, 1000);
  if (s && !/^https?:\/\/./.test(s)) throw new Error("Ссылка должна начинаться с https:// или http://.");
  return s;
}
function int(v, min, max, message) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(message);
  return n;
}
function optionalInt(v, min, max, label) {
  return v === "" || v == null ? null : int(v, min, max, `${label}: число от ${min} до ${max}.`);
}
function amount(v) {
  const n = Number(required(v,"Сумма",12));
  if (!Number.isFinite(n) || Math.abs(n) > 10000000) throw new Error("Сумма должна быть числом до 10 000 000.");
  return n;
}
function oneOf(v, list, label) {
  const s = String(v == null ? "" : v);
  if (!list.includes(s)) throw new Error(`Выберите значение поля «${label}».`);
  return s;
}
function username(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(s)) throw new Error("Логин: 3–40 символов, латиница, цифры, точка, дефис или подчёркивание.");
  return s;
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const ERRORS = {
  "permission-denied":"Недостаточно прав для этого действия.",
  "unavailable":"Нет связи с сервером. Проверьте интернет.",
  "not-found":"Запись не найдена.",
  "auth/invalid-credential":"Неверный логин или пароль.",
  "auth/invalid-login-credentials":"Неверный логин или пароль.",
  "auth/wrong-password":"Неверный логин или пароль.",
  "auth/user-not-found":"Неверный логин или пароль.",
  "auth/invalid-email":"Неверный логин или пароль.",
  "auth/user-disabled":"Аккаунт отключён. Обратитесь к репетитору.",
  "auth/too-many-requests":"Слишком много попыток входа. Подождите несколько минут.",
  "auth/network-request-failed":"Нет связи с сервером. Проверьте интернет.",
  "auth/email-already-in-use":"Такой логин уже существует.",
  "auth/weak-password":"Пароль должен содержать не менее 6 символов."
};
function humanError(e) {
  return new Error(ERRORS[e && e.code] || (e && e.message) || "Ошибка запроса.");
}

/* ---------- Бэкенды ---------- */

export function emptyDataset() {
  return { settings:{ year:2026 }, users:[], materials:[], homework:[], schedule:[], grades:[], lessonNotes:[], payments:[], achievements:[], messages:[], topics:[] };
}
export function publicUser(u) {
  return { username:String(u.username || ""), name:String(u.name || ""), role:String(u.role || "student"), grade:u.grade == null ? "" : u.grade, child:String(u.child || "") };
}
const byDate = (a, b) => String(a.date).localeCompare(String(b.date));

let backendPromise = null;
function backend() {
  if (!backendPromise) backendPromise = DEMO ? import("./demo.js").then(m => m.createDemoBackend()) : createFirebaseBackend();
  return backendPromise;
}

async function createFirebaseBackend() {
  const [App, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
  ]);
  const app = App.initializeApp(firebaseConfig);
  const auth = A.getAuth(app), db = F.getFirestore(app);
  // Для локальной разработки: firebaseConfig.emulators = { auth:"http://127.0.0.1:9099", firestore:["127.0.0.1", 8080] }
  const emu = firebaseConfig.emulators;
  if (emu) { A.connectAuthEmulator(auth, emu.auth, { disableWarnings:true }); F.connectFirestoreEmulator(db, ...emu.firestore); }
  const email = name => `${name}@${USERNAME_DOMAIN}`;
  const col = name => F.collection(db, name);
  const rows = async q => (await F.getDocs(q)).docs.map(d => Object.assign({ id:d.id }, d.data()));
  const profile = async name => { const s = await F.getDoc(F.doc(db, "users", name)); return s.exists() ? s.data() : null; };
  const signedIn = async () => {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error("Сессия истекла. Войдите снова.");
  };

  return {
    async hasSession() { await auth.authStateReady(); return !!auth.currentUser; },

    async login(name, password) {
      const cred = await A.signInWithEmailAndPassword(auth, email(name), password);
      const p = await profile(name).catch(() => null);
      if (!p || p.uid !== cred.user.uid) {
        await A.signOut(auth);
        throw new Error("Аккаунт не подключён к кабинету. Обратитесь к репетитору.");
      }
      return publicUser(p);
    },

    logout: () => A.signOut(auth),

    async load(user) {
      await signedIn();
      const data = emptyDataset();
      if (user.role === "admin") {
        const lists = await Promise.all(COLLECTIONS.map(c => rows(col(c))));
        COLLECTIONS.forEach((c, i) => { data[c] = lists[i]; });
        data.users = data.users.map(publicUser);
        return data;
      }
      // Ученик и родитель запрашивают только записи своего ученика — ровно то, что разрешают правила.
      const me = await profile(user.username);
      if (!me) throw new Error("Аккаунт не найден. Войдите снова.");
      const student = me.role === "parent" ? String(me.child || "") : me.username;
      const child = me.role === "parent" ? (student ? await profile(student) : null) : me;
      const party = [...new Set([me.username, student].filter(Boolean))];
      const byStudent = c => student ? rows(F.query(col(c), F.where("student","==",student))) : Promise.resolve([]);
      const [materials, homework, schedule, grades, lessonNotes, payments, achievements, sent, received, topics] = await Promise.all([
        rows(col("materials")),
        byStudent("homework"),
        rows(F.query(col("schedule"), student ? F.where("student","in",["", student]) : F.where("student","==",""))),
        byStudent("grades"), byStudent("lessonNotes"), byStudent("payments"), byStudent("achievements"),
        rows(F.query(col("messages"), F.where("from","in",party))),
        rows(F.query(col("messages"), F.where("to","in",party))),
        rows(col("topics"))
      ]);
      const messages = new Map();
      [...sent, ...received].forEach(m => messages.set(m.id, m));
      Object.assign(data, {
        users:[publicUser(me), ...(child && child !== me ? [publicUser(child)] : [])],
        materials:materials.filter(m => m.grade == null || m.grade === "" || !child || String(m.grade) === String(child.grade)),
        homework, schedule, grades, lessonNotes, payments, achievements, topics,
        messages:[...messages.values()].sort(byDate)
      });
      return data;
    },

    async add(name, record) { await signedIn(); return (await F.addDoc(col(name), record)).id; },
    async update(name, id, patch) { await signedIn(); await F.updateDoc(F.doc(db, name, id), patch); },
    async remove(name, id) { await signedIn(); await F.deleteDoc(F.doc(db, name, id)); },

    async markRead(user) {
      await signedIn();
      const party = [...new Set([user.username, user.role === "parent" ? user.child : ""].filter(Boolean))];
      const snap = await F.getDocs(F.query(col("messages"), F.where("to","in",party), F.where("isRead","==",false)));
      const unread = snap.docs.filter(d => d.data().from !== user.username);
      if (unread.length) {
        const batch = F.writeBatch(db);
        unread.forEach(d => batch.update(d.ref, { isRead:true }));
        await batch.commit();
      }
      return unread.length;
    },

    // Новый аккаунт создаётся через отдельный экземпляр приложения, чтобы админ не вышел из своей сессии.
    async createUser(p, password) {
      await signedIn();
      if (await profile(p.username)) throw new Error("Такой логин уже существует.");
      if (p.role === "parent") {
        const c = await profile(p.child);
        if (!c || c.role !== "student") throw new Error("Выбранный ученик не найден.");
      }
      const tmp = App.initializeApp(firebaseConfig, "account-creator-" + Date.now());
      try {
        const tmpAuth = A.initializeAuth(tmp, { persistence:A.inMemoryPersistence });
        if (emu) A.connectAuthEmulator(tmpAuth, emu.auth, { disableWarnings:true });
        const cred = await A.createUserWithEmailAndPassword(tmpAuth, email(p.username), password);
        await A.signOut(tmpAuth);
        const record = Object.assign({}, p, { uid:cred.user.uid });
        await F.setDoc(F.doc(db, "users", p.username), record);
        return publicUser(record);
      } finally {
        await App.deleteApp(tmp);
      }
    }
  };
}

/* ---------- Тема ---------- */

// Тема выставляется ещё до загрузки модулей (инлайн-скрипт в <head>), здесь — только переключатель.
export function initTheme() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });
}
initTheme();

if (DEMO) {
  const tag = document.createElement("div");
  tag.className = "demo-tag";
  tag.textContent = "Демо-режим: тестовые данные";
  tag.title = "Заполните js/firebase-config.js, чтобы подключить Firebase";
  document.body.appendChild(tag);
}
