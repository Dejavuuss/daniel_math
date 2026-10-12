/**
 * API сайта репетитора: Google Apps Script + Google Sheets.
 * POST отправляются с Content-Type: text/plain;charset=utf-8 — это позволяет
 * избежать CORS preflight. Проверка прав выполняется на сервере по токену сессии.
 */
const SPREADSHEET_ID = '';
const SHEETS = ['users', 'materials', 'homework', 'schedule', 'grades'];
const SESSION_TTL_SECONDS = 21600;
const HEADERS = {
  users: ['username','password','name','role','grade','child'],
  materials: ['id','title','grade','url','description'],
  homework: ['id','student','title','assigned','due','status','link'],
  schedule: ['id','date','time','type','title','description','student'],
  grades: ['id','student','subject','grade','date','comment']
};

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const user = validateSession_(params.token, params.username);
    if (!user) return json_({ ok:false, error:'Сессия истекла или не найдена. Войдите снова.' });
    const ss = getSpreadsheet_(); ensureSchema_(ss);
    const allUsers = readSheet_(ss, 'users');
    const safeUsers = allUsers.map(publicUser_);
    const result = { settings:{year:2026}, users:[], materials:[], homework:[], schedule:[], grades:[] };
    if (String(user.role) === 'admin') {
      result.users = safeUsers;
      result.materials = readSheet_(ss,'materials');
      result.homework = readSheet_(ss,'homework');
      result.schedule = readSheet_(ss,'schedule');
      result.grades = readSheet_(ss,'grades');
    } else {
      const childUsername = String(user.role) === 'parent' ? String(user.child || '') : String(user.username);
      const child = allUsers.find(u => String(u.username) === childUsername && String(u.role) === 'student');
      result.users = [publicUser_(user)];
      if (child) result.users.push(publicUser_(child));
      result.materials = readSheet_(ss,'materials').filter(m => !m.grade || !child || String(m.grade) === String(child.grade));
      result.homework = readSheet_(ss,'homework').filter(h => String(h.student) === childUsername);
      result.schedule = readSheet_(ss,'schedule').filter(ev => !ev.student || String(ev.student) === childUsername);
      result.grades = readSheet_(ss,'grades').filter(g => String(g.student) === childUsername);
    }
    return json_(result);
  } catch (err) { return json_({ok:false,error:String(err.message || err)}); }
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(p.action || '');
    if (action === 'login') return json_(login_(p.username, p.password));
    const user = validateSession_(p.token, p.username);
    if (!user) return json_({ok:false,error:'Сессия истекла. Войдите снова.'});
    const ss = getSpreadsheet_(); ensureSchema_(ss);
    switch (action) {
      case 'addMaterial':
        requireAdmin_(user);
        return json_({ok:true,item:appendRecord_('materials',{id:nextId_('materials'),title:required_(p.title,'Название'),grade:p.grade===''||p.grade==null?'':Number(p.grade),url:validateOptionalUrl_(p.url),description:String(p.description||'')})});
      case 'addHomework':
        requireAdmin_(user);
        return json_({ok:true,item:appendRecord_('homework',{id:nextId_('homework'),student:required_(p.student,'Ученик'),title:required_(p.title,'Задание'),assigned:required_(p.assigned,'Дата выдачи'),due:required_(p.due,'Срок сдачи'),status:'pending',link:validateOptionalUrl_(p.link)})});
      case 'updateHomeworkStatus': return json_(updateHomeworkStatus_(user,p));
      case 'addEvent':
        requireAdmin_(user);
        return json_({ok:true,item:appendRecord_('schedule',{id:nextId_('schedule'),date:required_(p.date,'Дата'),time:String(p.time||''),type:required_(p.type,'Тип'),title:required_(p.title,'Название'),description:String(p.description||''),student:String(p.student||'')})});
      case 'addParent':
        requireAdmin_(user);
        return json_({ok:true,item:addParent_(p)});
      case 'addGrade':
        requireAdmin_(user);
        const grade = Number(p.grade);
        if (!Number.isFinite(grade) || grade < 1 || grade > 5) throw new Error('Оценка должна быть от 1 до 5.');
        return json_({ok:true,item:appendRecord_('grades',{id:nextId_('grades'),student:required_(p.student,'Ученик'),subject:validateSubject_(p.subject),grade:grade,date:required_(p.date,'Дата'),comment:String(p.comment||'')})});
      case 'deleteRow': requireAdmin_(user); return json_(deleteRow_(p));
      default: return json_({ok:false,error:'Неизвестное действие.'});
    }
  } catch (err) { return json_({ok:false,error:String(err.message || err)}); }
}

function login_(username,password) {
  username=String(username||'').trim(); password=String(password||'');
  const user=readSheet_(getSpreadsheet_(),'users').find(u=>String(u.username).toLowerCase()===username.toLowerCase());
  if(!user || String(user.password)!==password) return {ok:false,error:'Неверный логин или пароль.'};
  const safe=publicUser_(user), token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('session:'+token,JSON.stringify({username:safe.username}),SESSION_TTL_SECONDS);
  return {ok:true,user:safe,token:token};
}
function validateSession_(token,username) {
  if(!token||!username)return null;
  const raw=CacheService.getScriptCache().get('session:'+String(token)); if(!raw)return null;
  const session=JSON.parse(raw); if(session.username!==String(username))return null;
  return readSheet_(getSpreadsheet_(),'users').find(u=>String(u.username)===session.username)||null;
}
function addParent_(p) {
  const username=required_(p.username,'Логин').trim();
  if(!/^[a-zA-Z0-9._-]{3,40}$/.test(username))throw new Error('Логин: 3–40 символов, латиница, цифры, точка, дефис или подчёркивание.');
  const ss=getSpreadsheet_(), users=readSheet_(ss,'users');
  if(users.some(u=>String(u.username).toLowerCase()===username.toLowerCase()))throw new Error('Такой логин уже существует.');
  const password=required_(p.password,'Пароль'); if(password.length<6)throw new Error('Пароль должен содержать не менее 6 символов.');
  const child=required_(p.child,'Ученик');
  if(!users.some(u=>String(u.username)===child&&String(u.role)==='student'))throw new Error('Выбранный ученик не найден.');
  const created = appendRecord_('users',{username,password,name:required_(p.name,'Имя родителя'),role:'parent',grade:'',child:child});
  return publicUser_(created);
}
function updateHomeworkStatus_(user,p) {
  const id=String(p.homeworkId==null?'':p.homeworkId), status=String(p.status||'');
  if(!id||!['pending','done'].includes(status))throw new Error('Некорректный ID или статус.');
  const sheet=getSpreadsheet_().getSheetByName('homework'), data=sheet.getDataRange().getValues(), headers=data[0].map(String);
  const idCol=headers.indexOf('id'), studentCol=headers.indexOf('student'), statusCol=headers.indexOf('status');
  for(let i=1;i<data.length;i++)if(String(data[i][idCol])===id){
    const allowed=String(user.role)==='admin'||String(data[i][studentCol])===String(user.username)||(String(user.role)==='parent'&&String(data[i][studentCol])===String(user.child||''));
    if(!allowed)throw new Error('Нельзя изменять чужое домашнее задание.');
    sheet.getRange(i+1,statusCol+1).setValue(status); return {ok:true,homeworkId:id,status};
  }
  throw new Error('Домашнее задание не найдено.');
}
function deleteRow_(p) {
  const name=String(p.sheet||''),id=String(p.id==null?'':p.id);
  if(!['materials','homework','schedule','grades'].includes(name)||!id)throw new Error('Некорректная запись для удаления.');
  const sheet=getSpreadsheet_().getSheetByName(name),data=sheet.getDataRange().getValues(),col=data[0].map(String).indexOf('id');
  for(let i=1;i<data.length;i++)if(String(data[i][col])===id){sheet.deleteRow(i+1);return {ok:true};}
  throw new Error('Запись не найдена.');
}
function requireAdmin_(u){if(String(u.role)!=='admin')throw new Error('Недостаточно прав: требуется администратор.');}
function getSpreadsheet_(){if(SPREADSHEET_ID)return SpreadsheetApp.openById(SPREADSHEET_ID);const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw new Error('Укажите SPREADSHEET_ID в Code.gs.');return ss;}
function ensureSchema_(ss){
  Object.keys(HEADERS).forEach(name=>{
    let sh=ss.getSheetByName(name);
    if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);return;}
    if(sh.getLastRow()===0){sh.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);return;}
    const current=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(String);
    HEADERS[name].forEach(h=>{if(current.indexOf(h)<0){sh.getRange(1,sh.getLastColumn()+1).setValue(h);current.push(h);}});
  });
}
function readSheet_(ss,name){const sh=ss.getSheetByName(name);if(!sh)throw new Error('Не найден лист "'+name+'".');const values=sh.getDataRange().getValues();if(values.length<2)return [];const headers=values[0].map(String);return values.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>{const o={};headers.forEach((h,i)=>o[h]=normalizeCell_(r[i]));return o;});}
function normalizeCell_(v){if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');return v;}
function publicUser_(u){return {username:String(u.username||''),name:String(u.name||''),role:String(u.role||'student'),grade:u.grade===''||u.grade==null?'':u.grade,child:String(u.child||'')};}
function nextId_(name){return Math.max(0,...readSheet_(getSpreadsheet_(),name).map(r=>Number(r.id)||0))+1;}
function appendRecord_(name,record){const sh=getSpreadsheet_().getSheetByName(name);if(!sh)throw new Error('Не найден лист: '+name);const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);sh.appendRow(headers.map(h=>record[h]==null?'':record[h]));return record;}
function validateOptionalUrl_(v){const s=String(v||'').trim();if(s&&!/^https?:\/\//i.test(s))throw new Error('Ссылка должна начинаться с https:// или http://.');return s;}
function validateSubject_(v){const s=String(v||'');if(!['Математика','Алгебра','Геометрия'].includes(s))throw new Error('Выберите предмет: математика, алгебра или геометрия.');return s;}
function required_(v,label){const s=String(v==null?'':v).trim();if(!s)throw new Error('Заполните поле: '+label+'.');return s;}
function json_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
