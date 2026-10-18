// Загрузка content/content.json на сайт от имени репетитора — через те же правила Firestore, что и панель.
//   CONTENT_LOGIN=danya CONTENT_PASSWORD=… node content/upload.mjs            # загрузить / обновить
//   CONTENT_LOGIN=danya CONTENT_PASSWORD=… node content/upload.mjs --remove   # удалить всё загруженное (id «seed-…»)
// Для эмулятора: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 (проект demo-math-tutor).
// SDK берётся из tests/node_modules (cd tests && npm install).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { initializeApp } from "../tests/node_modules/firebase/app/dist/index.mjs";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "../tests/node_modules/firebase/auth/dist/index.mjs";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, deleteDoc, collection, getDocs } from "../tests/node_modules/firebase/firestore/dist/index.mjs";

const ROOT = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), "utf8");
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const cfgSrc = read("js/firebase-config.js");
const domain = /USERNAME_DOMAIN = "([^"]+)"/.exec(cfgSrc)[1];
const config = emulator ? { apiKey:"fake", projectId:"demo-math-tutor", authDomain:"demo-math-tutor.firebaseapp.com" }
  : Object.fromEntries([...cfgSrc.matchAll(/(apiKey|authDomain|projectId|appId|messagingSenderId|storageBucket): "([^"]+)"/g)].map(m => [m[1], m[2]]));

const login = process.env.CONTENT_LOGIN, password = process.env.CONTENT_PASSWORD;
if (!login || !password) { console.error("Задайте CONTENT_LOGIN и CONTENT_PASSWORD (логин и пароль репетитора)."); process.exit(1); }

const app = initializeApp(config);
const auth = getAuth(app), db = getFirestore(app);
if (emulator) {
  connectAuthEmulator(auth, "http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings:true });
  const [h, p] = process.env.FIRESTORE_EMULATOR_HOST.split(":"); connectFirestoreEmulator(db, h, +p);
}
await signInWithEmailAndPassword(auth, `${login}@${domain}`, password);
console.log(`Вошли как ${login} (${emulator ? "эмулятор" : config.projectId})`);

// Параллельно, но понемногу — чтобы не упереться в лимиты.
async function run(tasks, label) {
  let done = 0;
  for (let i = 0; i < tasks.length; i += 8) {
    await Promise.all(tasks.slice(i, i + 8).map(t => t()));
    done = Math.min(tasks.length, i + 8);
    process.stdout.write(`\r  ${label}: ${done}/${tasks.length}`);
  }
  if (tasks.length) process.stdout.write("\n");
}

if (process.argv.includes("--remove")) {
  for (const name of ["problems", "tests", "testKeys", "materials"]) {
    const snap = await getDocs(collection(db, name));
    await run(snap.docs.filter(d => d.id.startsWith("seed-")).map(d => () => deleteDoc(d.ref)), `удаление ${name}`);
  }
  console.log("Готово: загруженная база удалена, записи репетитора не тронуты.");
  process.exit(0);
}

const { problems, tests, materials } = JSON.parse(read("content/content.json"));

// Внешние ссылки: оставляем только те, что открываются. Проверяем через curl — он доверяет тем же
// сертификатам, что и браузер (у Node.js нет российских корневых сертификатов, нужных, например, ФИПИ).
const checked = [];
for (const m of materials) {
  if (!m.url) { checked.push(m); continue; }
  let code = "000";
  for (let attempt = 0; attempt < 3 && !/^[23]/.test(code); attempt++) {   // некоторые сайты отвечают медленно
    try { code = execFileSync("curl", ["-s", "-L", "-o", process.platform === "win32" ? "NUL" : "/dev/null", "-m", "30", "-A", "Mozilla/5.0", "-w", "%{http_code}", encodeURI(m.url)], { encoding:"utf8" }).trim(); } catch (_) {}
  }
  if (/^[23]/.test(code)) checked.push(m); else console.log(`  ссылка пропущена (${code}): ${m.url}`);
}

const strip = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
await run(problems.map(p => () => setDoc(doc(db, "problems", p.id), strip(p, ["topic", "grade", "difficulty", "text", "answer", "solution"]))), "задачи");
await run(tests.map(t => async () => {
  await setDoc(doc(db, "tests", t.id), strip(t, ["title", "topic", "grade", "student", "description", "date", "questions"]));
  await setDoc(doc(db, "testKeys", t.id), { answers:t.answers });
}), "тесты");
await run(checked.map(m => () => setDoc(doc(db, "materials", m.id), strip(m, ["title", "grade", "url", "description", "topic", "type"]))), "материалы");
console.log(`Готово: задач ${problems.length}, тестов ${tests.length}, материалов ${checked.length}.`);
process.exit(0);
