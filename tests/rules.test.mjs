// Тесты firestore.rules на эмуляторе. Запуск из папки tests: npm install && npm test (нужна Java 21+).
// Запросы повторяют те, что делает js/auth.js, — если правила их не пропустят, кабинет сломается.
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, where, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, setLogLevel
} from "firebase/firestore";

setLogLevel("silent"); // отказы в тестах-атаках ожидаемы, не засоряем ими вывод

const DOMAIN = "math-tutor.example";
let env;

const USERS = {
  teacher:     { uid:"u-teacher", name:"Мария Ивановна", role:"admin",   grade:null, child:"" },
  ivan:        { uid:"u-ivan",    name:"Иван Петров",    role:"student", grade:9,    child:"" },
  anna:        { uid:"u-anna",    name:"Анна Соколова",  role:"student", grade:7,    child:"" },
  parent_ivan: { uid:"u-pivan",   name:"Алексей Петров", role:"parent",  grade:null, child:"ivan" }
};
const hw = (student, extra = {}) => Object.assign({ student, title:"№ 412", assigned:"2026-10-10", due:"2026-10-17", status:"pending", link:"", comment:"" }, extra);
const msg = (from, to, extra = {}) => Object.assign({ from, to, text:"Привет", date:"2026-10-15", isRead:false }, extra);

// Firestore от имени пользователя с тем же токеном, что выдаёт Firebase Auth.
const as = name => env.authenticatedContext(USERS[name].uid, { email:`${name}@${DOMAIN}` }).firestore();
const stranger = (uid, email) => env.authenticatedContext(uid, { email }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId:"demo-math-tutor",
    firestore:{ rules:readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [username, u] of Object.entries(USERS)) await setDoc(doc(db, "users", username), Object.assign({ username }, u));
    await setDoc(doc(db, "homework", "h-ivan"), hw("ivan"));
    await setDoc(doc(db, "homework", "h-anna"), hw("anna"));
    await setDoc(doc(db, "grades", "g-ivan"), { student:"ivan", subject:"Алгебра", grade:5, date:"2026-10-01", comment:"" });
    await setDoc(doc(db, "grades", "g-anna"), { student:"anna", subject:"Алгебра", grade:4, date:"2026-10-01", comment:"" });
    await setDoc(doc(db, "schedule", "e-all"),  { date:"2026-10-20", time:"", type:"olympiad", title:"Олимпиада", description:"", student:"", status:"planned" });
    await setDoc(doc(db, "schedule", "e-ivan"), { date:"2026-10-16", time:"16:00", type:"lesson", title:"Занятие", description:"", student:"ivan", status:"planned" });
    await setDoc(doc(db, "schedule", "e-anna"), { date:"2026-10-16", time:"17:00", type:"lesson", title:"Занятие", description:"", student:"anna", status:"planned" });
    await setDoc(doc(db, "materials", "m1"), { title:"Конспект", grade:9, url:"", description:"", topic:"", type:"material" });
    await setDoc(doc(db, "messages", "to-ivan"),   msg("teacher", "ivan"));
    await setDoc(doc(db, "messages", "from-ivan"), msg("ivan", "teacher"));
    await setDoc(doc(db, "messages", "to-parent"), msg("teacher", "parent_ivan"));
    await setDoc(doc(db, "messages", "to-anna"),   msg("teacher", "anna"));
  });
});

/* ---------- Вход и чужаки ---------- */

test("без входа ничего не читается", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, "materials")));
  await assertFails(getDoc(doc(db, "users", "teacher")));
});

test("аккаунт с тем же логином на другом домене не становится админом", async () => {
  const db = stranger("evil-uid", "teacher@evil.com");
  await assertFails(getDoc(doc(db, "users", "teacher")));
  await assertFails(getDocs(collection(db, "homework")));
  await assertFails(addDoc(collection(db, "materials"), { title:"x", grade:null, url:"", description:"", topic:"", type:"material" }));
});

test("зарегистрировавшийся сам без профиля не видит данных", async () => {
  const db = stranger("new-uid", `hacker@${DOMAIN}`);
  await assertFails(getDocs(collection(db, "materials")));
  await assertFails(setDoc(doc(db, "users", "hacker"), { username:"hacker", uid:"new-uid", name:"H", role:"admin", grade:null, child:"" }));
  await assertFails(setDoc(doc(db, "users", "hacker"), { username:"hacker", uid:"new-uid", name:"H", role:"student", grade:9, child:"" }));
});

/* ---------- Ученик ---------- */

test("ученик: запросы кабинета проходят", async () => {
  const db = as("ivan");
  await assertSucceeds(getDoc(doc(db, "users", "ivan")));
  await assertSucceeds(getDocs(collection(db, "materials")));
  await assertSucceeds(getDocs(collection(db, "topics")));
  for (const c of ["homework", "grades", "lessonNotes", "payments", "achievements"]) {
    await assertSucceeds(getDocs(query(collection(db, c), where("student", "==", "ivan"))));
  }
  const events = await assertSucceeds(getDocs(query(collection(db, "schedule"), where("student", "in", ["", "ivan"]))));
  if (events.size !== 2) throw new Error("ожидалось 2 события, получено " + events.size);
  await assertSucceeds(getDocs(query(collection(db, "messages"), where("from", "in", ["ivan"]))));
  await assertSucceeds(getDocs(query(collection(db, "messages"), where("to", "in", ["ivan"]))));
});

test("ученик не видит чужое", async () => {
  const db = as("ivan");
  await assertFails(getDocs(collection(db, "homework")));
  await assertFails(getDocs(query(collection(db, "homework"), where("student", "==", "anna"))));
  await assertFails(getDoc(doc(db, "grades", "g-anna")));
  await assertFails(getDoc(doc(db, "users", "anna")));
  await assertFails(getDoc(doc(db, "users", "parent_ivan")));
  await assertFails(getDocs(collection(db, "schedule")));
  await assertFails(getDocs(query(collection(db, "messages"), where("to", "in", ["parent_ivan"]))));
  await assertFails(getDoc(doc(db, "messages", "to-anna")));
});

test("ученик меняет только статус своего задания", async () => {
  const db = as("ivan");
  await assertSucceeds(updateDoc(doc(db, "homework", "h-ivan"), { status:"done" }));
  await assertSucceeds(updateDoc(doc(db, "homework", "h-ivan"), { status:"pending" }));
  await assertFails(updateDoc(doc(db, "homework", "h-ivan"), { status:"approved" }));
  await assertFails(updateDoc(doc(db, "homework", "h-ivan"), { title:"Ничего не задано" }));
  await assertFails(updateDoc(doc(db, "homework", "h-ivan"), { status:"done", due:"2030-01-01" }));
  await assertFails(updateDoc(doc(db, "homework", "h-anna"), { status:"done" }));
  await assertFails(deleteDoc(doc(db, "homework", "h-ivan")));
});

test("ученик не может выставлять оценки, выдавать задания и повышать себе роль", async () => {
  const db = as("ivan");
  await assertFails(addDoc(collection(db, "grades"), { student:"ivan", subject:"Алгебра", grade:5, date:"2026-10-15", comment:"" }));
  await assertFails(addDoc(collection(db, "homework"), hw("ivan")));
  await assertFails(updateDoc(doc(db, "users", "ivan"), { role:"admin" }));
  await assertFails(setDoc(doc(db, "users", "ivan"), Object.assign({ username:"ivan" }, USERS.ivan, { role:"admin" })));
});

test("сообщения ученика: только от своего имени и разрешённым адресатам", async () => {
  const db = as("ivan");
  await assertSucceeds(addDoc(collection(db, "messages"), msg("ivan", "teacher")));
  await assertSucceeds(addDoc(collection(db, "messages"), msg("ivan", "parent_ivan")));
  await assertFails(addDoc(collection(db, "messages"), msg("ivan", "anna")));
  await assertFails(addDoc(collection(db, "messages"), msg("teacher", "ivan")));
  await assertFails(addDoc(collection(db, "messages"), msg("ivan", "teacher", { isRead:true })));
  await assertFails(addDoc(collection(db, "messages"), msg("ivan", "teacher", { text:"x".repeat(2001) })));
  await assertFails(addDoc(collection(db, "messages"), msg("ivan", "teacher", { extra:"поле" })));
});

test("отметить прочитанным: запрос и пакет как в js/auth.js", async () => {
  const db = as("ivan");
  const snap = await assertSucceeds(getDocs(query(collection(db, "messages"), where("to", "in", ["ivan"]), where("isRead", "==", false))));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { isRead:true }));
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(db, "messages", "from-ivan"), { isRead:true }));
  await assertFails(updateDoc(doc(db, "messages", "to-ivan"), { isRead:true, text:"подмена" }));
});

/* ---------- Родитель ---------- */

test("родитель видит записи своего ребёнка", async () => {
  const db = as("parent_ivan");
  await assertSucceeds(getDoc(doc(db, "users", "parent_ivan")));
  await assertSucceeds(getDoc(doc(db, "users", "ivan")));
  await assertSucceeds(getDocs(query(collection(db, "homework"), where("student", "==", "ivan"))));
  await assertSucceeds(getDocs(query(collection(db, "grades"), where("student", "==", "ivan"))));
  await assertSucceeds(getDocs(query(collection(db, "schedule"), where("student", "in", ["", "ivan"]))));
  await assertSucceeds(getDocs(query(collection(db, "messages"), where("from", "in", ["parent_ivan", "ivan"]))));
  await assertSucceeds(getDocs(query(collection(db, "messages"), where("to", "in", ["parent_ivan", "ivan"]))));
});

test("родитель не видит чужих детей", async () => {
  const db = as("parent_ivan");
  await assertFails(getDoc(doc(db, "users", "anna")));
  await assertFails(getDocs(query(collection(db, "homework"), where("student", "==", "anna"))));
  await assertFails(getDocs(query(collection(db, "messages"), where("to", "in", ["anna"]))));
  await assertFails(getDocs(collection(db, "users")));
});

test("родитель может отметить задание ребёнка и написать ребёнку или репетитору", async () => {
  const db = as("parent_ivan");
  await assertSucceeds(updateDoc(doc(db, "homework", "h-ivan"), { status:"done" }));
  await assertFails(updateDoc(doc(db, "homework", "h-anna"), { status:"done" }));
  await assertSucceeds(addDoc(collection(db, "messages"), msg("parent_ivan", "teacher")));
  await assertSucceeds(addDoc(collection(db, "messages"), msg("parent_ivan", "ivan")));
  await assertFails(addDoc(collection(db, "messages"), msg("parent_ivan", "anna")));
});

/* ---------- Репетитор ---------- */

test("репетитор читает всё и пишет корректные записи", async () => {
  const db = as("teacher");
  for (const c of ["users", "materials", "homework", "schedule", "grades", "lessonNotes", "payments", "achievements", "messages", "topics"]) {
    await assertSucceeds(getDocs(collection(db, c)));
  }
  await assertSucceeds(addDoc(collection(db, "materials"), { title:"Новый", grade:null, url:"https://example.com", description:"", topic:"", type:"video" }));
  await assertSucceeds(addDoc(collection(db, "homework"), hw("anna")));
  await assertSucceeds(addDoc(collection(db, "grades"), { student:"anna", subject:"Геометрия", grade:3, date:"2026-10-15", comment:"" }));
  await assertSucceeds(addDoc(collection(db, "lessonNotes"), { date:"2026-10-15", student:"ivan", topic:"Виета", note:"", rating:4, duration:60 }));
  await assertSucceeds(addDoc(collection(db, "payments"), { date:"2026-10-15", student:"ivan", amount:2000, type:"lesson", description:"" }));
  await assertSucceeds(addDoc(collection(db, "achievements"), { student:"ivan", title:"Пятёрка", description:"", date:"2026-10-15", icon:"🏛" }));
  await assertSucceeds(addDoc(collection(db, "schedule"), { date:"2026-10-22", time:"", type:"test", title:"Контрольная", description:"", student:"", status:"planned" }));
  await assertSucceeds(addDoc(collection(db, "topics"), { subject:"Алгебра", title:"Неравенства", description:"" }));
  await assertSucceeds(addDoc(collection(db, "messages"), msg("teacher", "anna")));
  await assertSucceeds(deleteDoc(doc(db, "grades", "g-anna")));
});

test("репетитор: некорректные записи отклоняются", async () => {
  const db = as("teacher");
  await assertFails(addDoc(collection(db, "materials"), { title:"", grade:null, url:"", description:"", topic:"", type:"material" }));
  await assertFails(addDoc(collection(db, "materials"), { title:"x", grade:null, url:"javascript:alert(1)", description:"", topic:"", type:"material" }));
  await assertFails(addDoc(collection(db, "materials"), { title:"x".repeat(201), grade:null, url:"", description:"", topic:"", type:"material" }));
  await assertFails(addDoc(collection(db, "grades"), { student:"ivan", subject:"Алгебра", grade:6, date:"2026-10-15", comment:"" }));
  await assertFails(addDoc(collection(db, "grades"), { student:"ivan", subject:"Алгебра", grade:"5", date:"2026-10-15", comment:"" }));
  await assertFails(addDoc(collection(db, "homework"), hw("ivan", { due:"15.10.2026" })));
  await assertFails(addDoc(collection(db, "homework"), hw("ivan", { hacked:true })));
});

test("репетитор создаёт учеников и родителей, но не админов", async () => {
  const db = as("teacher");
  await assertSucceeds(setDoc(doc(db, "users", "petr"), { username:"petr", uid:"u-petr", name:"Пётр", role:"student", grade:8, child:"" }));
  await assertSucceeds(setDoc(doc(db, "users", "mama_anna"), { username:"mama_anna", uid:"u-ma", name:"Ольга", role:"parent", grade:null, child:"anna" }));
  await assertFails(setDoc(doc(db, "users", "boss"), { username:"boss", uid:"u-boss", name:"Босс", role:"admin", grade:null, child:"" }));
  await assertFails(setDoc(doc(db, "users", "papa"), { username:"papa", uid:"u-papa", name:"Папа", role:"parent", grade:null, child:"teacher" }));
  await assertFails(setDoc(doc(db, "users", "other"), { username:"another", uid:"u-o", name:"Не тот id", role:"student", grade:8, child:"" }));
  await assertFails(updateDoc(doc(db, "users", "ivan"), { uid:"u-stolen" }));
  await assertFails(deleteDoc(doc(db, "users", "teacher")));
});
