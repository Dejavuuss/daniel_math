// Шаг 2 миграции: перенос выгрузки Google Sheets в Firebase (Auth + Firestore).
//
//   cd migration && npm install
//   node import.mjs --export sheets-export.json --key service-account.json --dry-run   # проверка без записи
//   node import.mjs --export sheets-export.json --key service-account.json             # перенос
//
// service-account.json: Firebase Console → Project settings → Service accounts → Generate new private key.
// Ключ даёт полный доступ к проекту — храните его вне репозитория (.gitignore уже исключает такие файлы).
//
// Что делает скрипт:
//  • для каждого пользователя создаёт аккаунт Firebase Auth <логин>@USERNAME_DOMAIN с прежним паролем
//    (пароли короче 6 символов Firebase не принимает — для них генерируется новый и печатается в конце;
//    с --short-suffix 2026 к короткому паролю вместо этого дописывается «2026»);
//  • пишет профили в users/{логин} и все записи в коллекции с id вида legacy-<старый id>;
//  • приводит поля к типам из firestore.rules (числа, даты ГГГГ-ММ-ДД, isRead — boolean),
//    обрезает слишком длинные строки, пропускает строки без обязательных полей.
// Повторный запуск безопасен: существующие аккаунты переиспользуются, документы перезаписываются.
// Проверка на локальных эмуляторах: задайте FIRESTORE_EMULATOR_HOST и FIREBASE_AUTH_EMULATOR_HOST —
// тогда --key не нужен, а проект берётся из --project (по умолчанию demo-math-tutor).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const USERNAME_DOMAIN = "math-tutor.example"; // должен совпадать с js/firebase-config.js

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const DRY = !!args["dry-run"];
if (!args.export || (!args.key && !EMULATOR && !DRY)) {
  console.error("Использование: node import.mjs --export sheets-export.json --key service-account.json [--dry-run]");
  process.exit(1);
}
const data = JSON.parse(readFileSync(args.export, "utf8"));

/* ---------- Приведение типов (те же ограничения, что в firestore.rules) ---------- */
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const login = v => { const s = str(v, 40).toLowerCase(); return /^[a-z0-9._-]{3,40}$/.test(s) ? s : ""; };
const day = v => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
const url = v => { const s = str(v, 1000); return /^https?:\/\/./.test(s) ? s : ""; };
const int = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
const pick = (v, list, def) => list.includes(String(v)) ? String(v) : def;
const SUBJECTS = ["Математика","Алгебра","Геометрия"];

// Каждая функция возвращает документ или null (строка пропускается).
const MAP = {
  materials: r => {
    const title = str(r.title, 200); if (!title) return null;
    return { title, grade:int(r.grade, 1, 11, null), url:url(r.url), description:str(r.description, 2000), topic:str(r.topic, 200), type:pick(r.type, ["material","video","test","worksheet"], "material") };
  },
  homework: r => {
    const student = login(r.student), title = str(r.title, 300), assigned = day(r.assigned), due = day(r.due) || assigned;
    if (!student || !title || !assigned) return null;
    return { student, title, assigned, due, status:r.status === "done" ? "done" : "pending", link:url(r.link), comment:str(r.comment, 2000) };
  },
  schedule: r => {
    const date = day(r.date), title = str(r.title, 200); if (!date || !title) return null;
    const time = str(r.time, 5);
    return { date, time:/^\d{2}:\d{2}$/.test(time) ? time : "", type:pick(r.type, ["lesson","deadline","test","olympiad"], "lesson"), title, description:str(r.description, 2000), student:login(r.student), status:pick(r.status, ["planned","done","cancelled"], "planned") };
  },
  grades: r => {
    const student = login(r.student), grade = int(r.grade, 1, 5, null), date = day(r.date);
    if (!student || grade == null || !date) return null;
    return { student, subject:pick(r.subject, SUBJECTS, "Математика"), grade, date, comment:str(r.comment, 500) };
  },
  lessonNotes: r => {
    const date = day(r.date), student = login(r.student), topic = str(r.topic, 200);
    if (!date || !student || !topic) return null;
    return { date, student, topic, note:str(r.note, 5000), rating:int(r.rating, 0, 5, 0), duration:int(r.duration, 1, 600, 60) };
  },
  payments: r => {
    const date = day(r.date), student = login(r.student), amount = Number(r.amount);
    if (!date || !student || !Number.isFinite(amount) || Math.abs(amount) > 1e7) return null;
    return { date, student, amount, type:pick(r.type, ["paid","lesson","refund"], "paid"), description:str(r.description, 500) };
  },
  achievements: r => {
    const student = login(r.student), title = str(r.title, 120), date = day(r.date);
    if (!student || !title || !date) return null;
    return { student, title, description:str(r.description, 500), date, icon:str(r.icon || "🏆", 16) };
  },
  messages: r => {
    const from = login(r.from), to = login(r.to), text = str(r.text, 2000), date = day(r.date);
    if (!from || !to || !text || !date) return null;
    return { from, to, text, date, isRead:r.isRead === true || String(r.isRead).toLowerCase() === "true" };
  },
  topics: r => {
    const title = str(r.title, 200); if (!title) return null;
    return { subject:pick(r.subject, SUBJECTS, "Математика"), title, description:str(r.description, 2000) };
  }
};

/* ---------- Пользователи ---------- */
const users = (data.users || []).map(u => ({
  username:login(u.username), password:String(u.password == null ? "" : u.password), name:str(u.name, 100) || login(u.username),
  role:pick(u.role, ["admin","student","parent"], "student"), grade:int(u.grade, 1, 11, null), child:login(u.child)
}));
const problems = [], newPasswords = [];
const students = new Set(users.filter(u => u.role === "student" && u.username).map(u => u.username));
const seenLogins = new Set();
const validUsers = users.filter(u => {
  if (!u.username) { problems.push(`users: пропущен пользователь с некорректным логином («${u.name}»)`); return false; }
  if (seenLogins.has(u.username)) { problems.push(`users: логин ${u.username} повторяется («${u.name}») — переименуйте в таблице, запись пропущена`); return false; }
  seenLogins.add(u.username);
  if (u.role === "parent" && !students.has(u.child)) { problems.push(`users: у родителя ${u.username} не найден ученик «${u.child}» — пропущен`); return false; }
  return true;
});
// Ученики раньше родителей, админы первыми — порядок не важен для Admin SDK, но так понятнее в логе.
validUsers.sort((a, b) => ["admin","student","parent"].indexOf(a.role) - ["admin","student","parent"].indexOf(b.role));

const app = DRY ? null : initializeApp(EMULATOR
  ? { projectId:typeof args.project === "string" ? args.project : "demo-math-tutor" }
  : { credential:cert(JSON.parse(readFileSync(args.key, "utf8"))) });
const auth = DRY ? null : getAuth(app), db = DRY ? null : getFirestore(app);

console.log(DRY ? "Пробный запуск — в Firebase ничего не записывается.\n" : "Перенос в Firebase…\n");

for (const u of validUsers) {
  let password = u.password;
  if (password.length < 6) {
    // --short-suffix 2026: к короткому паролю дописывается суффикс; если и так коротко — случайный пароль.
    const padded = typeof args["short-suffix"] === "string" ? password + args["short-suffix"] : "";
    password = padded.length >= 6 ? padded : randomBytes(6).toString("base64url").slice(0, 8);
    newPasswords.push([u.username, u.name, password]);
  }
  const profile = { username:u.username, name:u.name, role:u.role, grade:u.role === "student" ? u.grade : null, child:u.role === "parent" ? u.child : "" };
  if (DRY) { console.log(`  ${u.role.padEnd(7)} ${u.username}`); continue; }
  const email = `${u.username}@${USERNAME_DOMAIN}`;
  let record;
  try {
    record = await auth.createUser({ email, password, displayName:u.name });
  } catch (e) {
    if (e.code !== "auth/email-already-exists") throw e;
    record = await auth.getUserByEmail(email);
    await auth.updateUser(record.uid, { password, displayName:u.name });
  }
  await db.collection("users").doc(u.username).set(Object.assign({ uid:record.uid }, profile));
  console.log(`  ${u.role.padEnd(7)} ${u.username}`);
}

/* ---------- Остальные коллекции ---------- */
const summary = [["users", validUsers.length, users.length - validUsers.length]];
for (const [name, map] of Object.entries(MAP)) {
  const rows = data[name] || [];
  const docs = [];
  rows.forEach((r, i) => {
    const doc = map(r);
    if (doc) docs.push([`legacy-${r.id != null && r.id !== "" ? r.id : "row" + (i + 2)}`, doc]);
    else problems.push(`${name}: строка ${i + 2} пропущена — не хватает обязательных полей`);
  });
  if (!DRY) {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach(([id, doc]) => batch.set(db.collection(name).doc(id), doc));
      await batch.commit();
    }
  }
  summary.push([name, docs.length, rows.length - docs.length]);
}

console.log("\nКоллекция        перенесено  пропущено");
summary.forEach(([n, ok, skip]) => console.log(`  ${n.padEnd(15)} ${String(ok).padStart(9)}  ${String(skip).padStart(9)}`));
if (problems.length) { console.log("\nЗамечания:"); problems.forEach(p => console.log("  • " + p)); }
if (newPasswords.length) {
  console.log("\nПароли короче 6 символов заменены — передайте новые пароли пользователям:");
  newPasswords.forEach(([u, n, p]) => console.log(`  ${u} (${n}): ${p}`));
}
console.log(DRY ? "\nПробный запуск завершён." : "\nГотово. Удалите файл выгрузки — в нём пароли открытым текстом.");
