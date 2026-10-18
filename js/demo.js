// Демо-бэкенд: тот же интерфейс, что у Firebase-бэкенда в auth.js, но данные живут в localStorage браузера.
// Включается автоматически, пока в js/firebase-config.js не вписан настоящий apiKey.
// Логины: teacher (репетитор), ivan (ученик), parent_ivan (родитель); пароль — любой.
import { COLLECTIONS, emptyDataset, publicUser } from "./auth.js";

const DB_KEY = "tutor_demo_db";
const FILE_KEY = "tutor_demo_file_";

function seed() {
  const d = (offset) => {
    const t = new Date(); t.setDate(t.getDate() + offset);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  };
  let n = 0; const id = () => "demo" + (++n);
  const rec = list => list.map(r => Object.assign({ id:id() }, r));
  return {
    users:[
      { username:"teacher", name:"Мария Ивановна", role:"admin", grade:null, child:"" },
      { username:"ivan", name:"Иван Петров", role:"student", grade:9, child:"" },
      { username:"anna", name:"Анна Соколова", role:"student", grade:7, child:"" },
      { username:"parent_ivan", name:"Алексей Петров", role:"parent", grade:null, child:"ivan" }
    ],
    materials:rec([
      { title:"Квадратные уравнения: конспект", grade:9, url:"https://ru.wikipedia.org/wiki/Квадратное_уравнение", description:"Дискриминант, теорема Виета, неполные уравнения.", topic:"Уравнения", type:"material" },
      { title:"Подобие треугольников", grade:9, url:"https://ru.wikipedia.org/wiki/Подобные_треугольники", description:"Три признака подобия с разобранными задачами.", topic:"Геометрия", type:"worksheet" },
      { title:"Золотое сечение в живописи", grade:null, url:"https://ru.wikipedia.org/wiki/Золотое_сечение", description:"Как пропорция φ ≈ 1,618 связывает Леонардо, Дюрера и спираль Фибоначчи.", topic:"Для любопытных", type:"video" },
      { title:"Дроби и проценты", grade:7, url:"", description:"Тренировочный лист на 20 задач.", topic:"Арифметика", type:"worksheet" }
    ]),
    homework:rec([
      { student:"ivan", title:"№ 412–418: дискриминант", assigned:d(-6), due:d(1), status:"pending", link:"https://ru.wikipedia.org/wiki/Дискриминант", comment:"Обрати внимание на № 416 — там два корня совпадают." },
      { student:"ivan", title:"Признаки подобия: 6 задач", assigned:d(-3), due:d(4), status:"pending", link:"", comment:"" },
      { student:"ivan", title:"Теорема Виета: устная разминка", assigned:d(-10), due:d(-4), status:"done", link:"", comment:"" },
      { student:"ivan", title:"Пробный вариант ОГЭ, часть 1", assigned:d(-9), due:d(-2), status:"pending", link:"", comment:"Засеки время: 90 минут." },
      { student:"anna", title:"Сложение дробей", assigned:d(-2), due:d(3), status:"pending", link:"", comment:"" }
    ]),
    schedule:rec([
      { date:d(0), time:"16:00", type:"lesson", title:"Занятие: теорема Виета", description:"Разбор ДЗ и новая тема.", student:"ivan", status:"planned" },
      { date:d(3), time:"16:00", type:"lesson", title:"Занятие: подобие", description:"", student:"ivan", status:"planned" },
      { date:d(1), time:"", type:"deadline", title:"Сдать № 412–418", description:"", student:"ivan", status:"planned" },
      { date:d(9), time:"10:00", type:"test", title:"Контрольная по алгебре", description:"Квадратные уравнения и неравенства.", student:"ivan", status:"planned" },
      { date:d(16), time:"11:00", type:"olympiad", title:"Школьный этап олимпиады", description:"Для всех учеников.", student:"", status:"planned" }
    ]),
    grades:rec([
      { student:"ivan", subject:"Алгебра", grade:4, date:d(-30), comment:"Линейные уравнения" },
      { student:"ivan", subject:"Геометрия", grade:3, date:d(-24), comment:"Теорема Пифагора" },
      { student:"ivan", subject:"Алгебра", grade:4, date:d(-17), comment:"Системы уравнений" },
      { student:"ivan", subject:"Алгебра", grade:5, date:d(-12), comment:"Неполные квадратные уравнения" },
      { student:"ivan", subject:"Геометрия", grade:4, date:d(-8), comment:"Площади" },
      { student:"ivan", subject:"Алгебра", grade:5, date:d(-2), comment:"Дискриминант" },
      { student:"anna", subject:"Математика", grade:5, date:d(-5), comment:"Дроби" }
    ]),
    lessonNotes:rec([
      { date:d(-2), student:"ivan", topic:"Дискриминант", note:"Уверенно находит корни через дискриминант. Путается в знаках, когда b отрицательное — повторить на следующем занятии.", rating:4, duration:60 },
      { date:d(-9), student:"ivan", topic:"Неполные квадратные уравнения", note:"Все типы решает без подсказок. Можно переходить к общему случаю.", rating:5, duration:60 },
      { date:d(-16), student:"ivan", topic:"Системы уравнений", note:"Метод подстановки освоен, метод сложения — пока с ошибками.", rating:3, duration:90 },
      { date:d(-3), student:"anna", topic:"Дроби", note:"Хорошо приводит к общему знаменателю.", rating:5, duration:60 }
    ]),
    payments:rec([
      { date:d(-20), student:"ivan", amount:8000, type:"paid", description:"4 занятия, сентябрь" },
      { date:d(-9), student:"ivan", amount:2000, type:"lesson", description:"Занятие" },
      { date:d(-2), student:"ivan", amount:2000, type:"lesson", description:"Занятие" }
    ]),
    achievements:rec([
      { student:"ivan", title:"Первая пятёрка", description:"Неполные квадратные уравнения без единой ошибки.", date:d(-12), icon:"🏛" },
      { student:"ivan", title:"Неделя без долгов", description:"Все задания сданы вовремя.", date:d(-5), icon:"🎻" },
      { student:"anna", title:"Мастер дробей", description:"", date:d(-5), icon:"🎨" }
    ]),
    messages:rec([
      { from:"teacher", to:"ivan", text:"Иван, в № 416 оба корня совпадают — это не ошибка. Подумай, почему.", date:d(-1), isRead:false },
      { from:"ivan", to:"teacher", text:"Понял, там дискриминант равен нулю!", date:d(-1), isRead:true },
      { from:"teacher", to:"parent_ivan", text:"Алексей, Иван заметно прибавил в алгебре. На этой неделе добавим геометрию.", date:d(-3), isRead:false }
    ]),
    files:[],
    topics:rec([
      { subject:"Алгебра", title:"Квадратные уравнения", description:"Дискриминант, теорема Виета." },
      { subject:"Геометрия", title:"Подобие треугольников", description:"" }
    ])
  };
}

function read() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { const db = JSON.parse(raw); db.files = db.files || []; return db; }
  } catch (_) {}
  const db = seed(); write(db); return db;
}
function write(db) { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (_) {} }
const wait = () => new Promise(r => setTimeout(r, 250));

export function createDemoBackend() {
  return {
    async hasSession() { return true; },

    async login(name) {
      await wait();
      const u = read().users.find(x => x.username === name);
      if (!u) throw new Error("В демо-режиме войдите как teacher, ivan или parent_ivan (пароль любой).");
      return publicUser(u);
    },

    async logout() {},

    async load(user) {
      await wait();
      const db = read(), data = emptyDataset();
      if (user.role === "admin") {
        COLLECTIONS.forEach(c => { data[c] = db[c].slice(); });
        data.users = db.users.map(publicUser);
        data.files = db.files.slice();
        return data;
      }
      const me = db.users.find(u => u.username === user.username);
      if (!me) throw new Error("Аккаунт не найден. Войдите снова.");
      const student = me.role === "parent" ? me.child : me.username;
      const child = db.users.find(u => u.username === student);
      const party = [me.username, student];
      const mine = c => db[c].filter(r => r.student === student);
      return Object.assign(data, {
        users:[me, ...(child && child !== me ? [child] : [])].map(publicUser),
        materials:db.materials.filter(m => m.grade == null || !child || String(m.grade) === String(child.grade)),
        homework:mine("homework"), grades:mine("grades"), lessonNotes:mine("lessonNotes"), payments:mine("payments"), achievements:mine("achievements"),
        schedule:db.schedule.filter(e => !e.student || e.student === student),
        messages:db.messages.filter(m => party.includes(m.from) || party.includes(m.to)),
        topics:db.topics.slice(),
        files:db.files.filter(f => f.kind === "material" || (f.kind === "homework" && f.student === student) ||
          (f.kind === "message" && (party.includes(f.from) || party.includes(f.to))))
      });
    },

    async add(name, record) {
      await wait();
      const db = read(), id = "demo" + Date.now();
      db[name].push(Object.assign({ id }, record)); write(db);
      return id;
    },

    async update(name, id, patch) {
      const db = read(), row = db[name].find(r => r.id === id);
      if (!row) throw new Error("Запись не найдена.");
      Object.assign(row, patch); write(db);
    },

    async remove(name, id) {
      await wait();
      const db = read(); db[name] = db[name].filter(r => r.id !== id); write(db);
    },

    // Содержимое файлов в демо-режиме — в localStorage браузера (несколько мегабайт на всё).
    async putFile(meta, chunks) {
      await wait();
      const id = "demofile" + Date.now() + Math.random().toString(36).slice(2, 6);
      const bin = chunks.map(c => { let t = ""; c.forEach(x => { t += String.fromCharCode(x); }); return btoa(t); });
      try { localStorage.setItem(FILE_KEY + id, JSON.stringify(bin)); }
      catch (_) { throw new Error("В демо-режиме не хватает места в браузере для этого файла."); }
      const db = read(); db.files.push(Object.assign({ id }, meta)); write(db);
      return id;
    },

    async getFile(id) {
      const raw = localStorage.getItem(FILE_KEY + id);
      if (!raw) throw new Error("Файл не найден.");
      return JSON.parse(raw).map(b => Uint8Array.from(atob(b), ch => ch.charCodeAt(0)));
    },

    async filesOf(kind, parentId) {
      return read().files.filter(f => f.kind === kind && f.parentId === parentId);
    },

    async removeFiles(list) {
      const db = read(), ids = list.map(f => f.id);
      ids.forEach(id => { try { localStorage.removeItem(FILE_KEY + id); } catch (_) {} });
      db.files = db.files.filter(f => !ids.includes(f.id)); write(db);
    },

    async markRead(user) {
      const db = read(), party = [user.username, user.child].filter(Boolean);
      let count = 0;
      db.messages.forEach(m => { if (party.includes(m.to) && m.from !== user.username && !m.isRead) { m.isRead = true; count++; } });
      write(db);
      return count;
    },

    async createUser(p) {
      await wait();
      const db = read();
      if (db.users.some(u => u.username === p.username)) throw new Error("Такой логин уже существует.");
      if (p.role === "parent" && !db.users.some(u => u.username === p.child && u.role === "student")) throw new Error("Выбранный ученик не найден.");
      db.users.push(p); write(db);
      return publicUser(p);
    }
  };
}
