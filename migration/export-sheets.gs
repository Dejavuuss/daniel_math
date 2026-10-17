/**
 * Шаг 1 миграции: выгрузка всех листов Google Sheets в JSON-файл на Google Диске.
 *
 * 1. Откройте таблицу → Extensions → Apps Script (тот же проект, где лежит старый Code.gs).
 * 2. Создайте файл export-sheets.gs, вставьте этот код, сохраните.
 * 3. Выберите функцию exportForFirebase и нажмите Run (Google попросит доступ к Диску).
 * 4. В журнале выполнения появится ссылка на файл sheets-export-….json — скачайте его.
 *
 * ВНИМАНИЕ: в файле есть пароли пользователей открытым текстом. После импорта удалите его
 * с Диска и с компьютера. Время в листе schedule выгружается как ЧЧ:ММ, даты — как ГГГГ-ММ-ДД.
 */
function exportForFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const names = ['users','materials','homework','schedule','grades','lessonNotes','payments','achievements','messages','topics'];
  const out = { exportedAt: new Date().toISOString() };
  names.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) { out[name] = []; return; }
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(String);
    out[name] = values.slice(1).filter(function (r) { return r.some(function (v) { return v !== ''; }); }).map(function (r) {
      const o = {};
      headers.forEach(function (h, i) {
        let v = r[i];
        // Ячейки «время» Google хранит как дату 30.12.1899 — превращаем их в ЧЧ:ММ.
        if (v instanceof Date) v = Utilities.formatDate(v, tz, v.getFullYear() < 1901 ? 'HH:mm' : 'yyyy-MM-dd');
        o[h] = v;
      });
      return o;
    });
  });
  const file = DriveApp.createFile(
    'sheets-export-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmm') + '.json',
    JSON.stringify(out, null, 2),
    MimeType.PLAIN_TEXT
  );
  Logger.log('Готово. Скачайте файл: ' + file.getUrl());
}
