/**
 * Бэкенд сайта репетитора. Данные хранятся в Google Sheets.
 * ВАЖНО: POST из браузера отправляются с Content-Type: text/plain;charset=utf-8,
 * чтобы не вызывать CORS preflight. Apps Script Web App возвращает JSON через ContentService.
 *
 * Настройка: укажите ID таблицы в SPREADSHEET_ID либо привяжите скрипт к таблице
 * (тогда оставьте пустую строку). Деплой Web app: Execute as Me, Who has access: Anyone.
 */
const SPREADSHEET_ID = ''; // ID таблицы; пусто, если скрипт создан из Extensions → Apps Script
const SHEETS = ['users', 'materials', 'homework', 'schedule'];
const SESSION_TTL_SECONDS = 21600; // 6 часов

function doGet(e) {
  try {
    const ss = getSpreadsheet_();
    const result = {};
    SHEETS.forEach(name => {
      const rows = readSheet_(ss, name);
      // Пароли никогда не отправляются клиенту.
      result[name] = name === 'users' ? rows.map(publicUser_) : rows;
    });
    result.settings = { year: 2026 };
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(payload.action || '');
    if (action === 'login') return json_(login_(payload.username, payload.password));

    // Все операции кроме login требуют выданной сервером сессии.
    const user = validateSession_(payload.token, payload.username);
    if (!user) return json_({ ok: false, error: 'Сессия истекла. Войдите снова.' });

    switch (action) {
      case 'addMaterial':
        requireAdmin_(user);
        return json_({ ok: true, item: appendRecord_('materials', {
          id: nextId_('materials'), title: required_(payload.title, 'Название'),
          grade: payload.grade === '' || payload.grade == null ? '' : Number(payload.grade),
          url: String(payload.url || ''), description: String(payload.description || '')
        }) });
      case 'addHomework':
        requireAdmin_(user);
        return json_({ ok: true, item: appendRecord_('homework', {
          id: nextId_('homework'), student: required_(payload.student, 'Ученик'),
          title: required_(payload.title, 'Задание'), assigned: required_(payload.assigned, 'Дата выдачи'),
          due: required_(payload.due, 'Срок сдачи'), status: 'pending'
        }) });
      case 'updateHomeworkStatus':
        return json_(updateHomeworkStatus_(user, payload));
      case 'addEvent':
        requireAdmin_(user);
        return json_({ ok: true, item: appendRecord_('schedule', {
          id: nextId_('schedule'), date: required_(payload.date, 'Дата'),
          time: String(payload.time || ''), type: required_(payload.type, 'Тип'),
          title: required_(payload.title, 'Название'), description: String(payload.description || ''),
          student: String(payload.student || '')
        }) });
      case 'deleteRow':
        requireAdmin_(user);
        return json_(deleteRow_(payload));
      default:
        return json_({ ok: false, error: 'Неизвестное действие.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function login_(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  const user = readSheet_(getSpreadsheet_(), 'users').find(u => String(u.username).toLowerCase() === username.toLowerCase());
  if (!user || String(user.password) !== password) return { ok: false, error: 'Неверный логин или пароль.' };
  const safeUser = publicUser_(user);
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('session:' + token, JSON.stringify({ username: safeUser.username }), SESSION_TTL_SECONDS);
  return { ok: true, user: safeUser, token: token };
}

function validateSession_(token, username) {
  if (!token || !username) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('session:' + String(token));
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.username !== String(username)) return null;
  // Роль читается заново из таблицы, а не доверяется данным браузера.
  return readSheet_(getSpreadsheet_(), 'users').find(u => String(u.username) === session.username) || null;
}

function updateHomeworkStatus_(user, payload) {
  const id = String(payload.homeworkId == null ? '' : payload.homeworkId);
  const status = String(payload.status || '');
  if (!id || !['pending', 'done'].includes(status)) throw new Error('Некорректный ID или статус.');
  const ss = getSpreadsheet_(), sheet = ss.getSheetByName('homework');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const idCol = headers.indexOf('id'), studentCol = headers.indexOf('student'), statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      if (String(user.role) !== 'admin' && String(data[i][studentCol]) !== String(user.username)) {
        throw new Error('Нельзя изменять чужое домашнее задание.');
      }
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      return { ok: true, homeworkId: id, status: status };
    }
  }
  throw new Error('Домашнее задание не найдено.');
}

function deleteRow_(payload) {
  const name = String(payload.sheet || '');
  const id = String(payload.id == null ? '' : payload.id);
  if (!['materials', 'homework', 'schedule'].includes(name) || !id) throw new Error('Некорректная запись для удаления.');
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Лист не найден: ' + name);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String), idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('Запись не найдена.');
}

function requireAdmin_(user) {
  if (String(user.role) !== 'admin') throw new Error('Недостаточно прав: требуется администратор.');
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Укажите SPREADSHEET_ID в Code.gs.');
  return ss;
}

function readSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Не найден лист "' + name + '". Создайте лист и заголовки из README.');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((key, i) => obj[key] = normalizeCell_(row[i]));
    return obj;
  });
}

function normalizeCell_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value;
}

function publicUser_(user) {
  return { username: String(user.username || ''), name: String(user.name || ''),
    role: String(user.role || 'student'), grade: user.grade === '' || user.grade == null ? '' : user.grade };
}

function nextId_(name) {
  const ids = readSheet_(getSpreadsheet_(), name).map(r => Number(r.id) || 0);
  return Math.max(0, ...ids) + 1;
}

function appendRecord_(name, record) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Не найден лист "' + name + '".');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(h => record[h] == null ? '' : record[h]));
  return record;
}

function required_(value, label) {
  const s = String(value == null ? '' : value).trim();
  if (!s) throw new Error('Заполните поле: ' + label + '.');
  return s;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
