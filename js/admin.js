const adminUser = requireAuth("admin");
let state = {users:[],materials:[],homework:[],schedule:[],settings:{}};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
document.getElementById("logoutBtn").onclick = logout;
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
 document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===btn.dataset.tab));
}));
async function loadData() {
 const status=document.getElementById("adminStatus"); status.textContent="Загружаем данные…";
 try { state=await apiGet(); fillStudents(); renderLists(); status.textContent="Синхронизировано с Google Sheets"; }
 catch(e){status.textContent="Ошибка: "+e.message;}
}
function fillStudents() {
 const opts=state.users.filter(u=>u.role==="student").map(u=>`<option value="${esc(u.username)}">${esc(u.name)} (${esc(u.username)})</option>`).join("");
 document.getElementById("studentSelect").innerHTML=opts;
 document.getElementById("eventStudent").innerHTML='<option value="">Все ученики</option>'+opts;
}
function table(rows, fields, sheet) {
 if(!rows.length) return '<p class="muted">Записей пока нет.</p>';
 return `<div class="table-wrap"><table><thead><tr>${fields.map(f=>`<th>${f[1]}</th>`).join("")}<th>Действие</th></tr></thead><tbody>${rows.map(r=>`<tr>${fields.map(f=>`<td>${esc(r[f[0]])}</td>`).join("")}<td><button class="danger" data-delete-sheet="${sheet}" data-delete-id="${esc(r.id)}">Удалить</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderLists() {
 document.getElementById("l-materials").innerHTML=table(state.materials,[["title","Название"],["grade","Класс"],["url","Ссылка"]],"materials");
 document.getElementById("l-homework").innerHTML=table(state.homework,[["student","Ученик"],["title","Задание"],["assigned","Выдано"],["due","Дедлайн"],["status","Статус"]],"homework");
 document.getElementById("l-schedule").innerHTML=table(state.schedule,[["date","Дата"],["time","Время"],["type","Тип"],["title","Событие"],["student","Ученик"]],"schedule");
 document.querySelectorAll("[data-delete-sheet]").forEach(btn=>btn.onclick=async()=>{
   if(!confirm("Удалить эту запись?"))return;
   const sheet=btn.dataset.deleteSheet,id=btn.dataset.deleteId, list=state[sheet], index=list.findIndex(x=>String(x.id)===String(id));
   if(index<0)return; const [removed]=list.splice(index,1); renderLists();
   try { await apiPost({action:"deleteRow",sheet,id}); await loadData(); }
   catch(e){list.splice(index,0,removed);renderLists();alert("Не удалось удалить: "+e.message);}
 });
}
function formData(form){const o={};new FormData(form).forEach((v,k)=>o[k]=v);return o;}
async function submitForm(form, action, map) {
 form.addEventListener("submit", async e=>{
  e.preventDefault(); const button=form.querySelector('button[type="submit"]'), oldText=button.textContent;
  button.disabled=true;button.textContent="Сохраняем…";
  try { await apiPost(Object.assign({action},map(formData(form)))); form.reset(); await loadData(); }
  catch(err){alert("Не удалось сохранить: "+err.message);}
  finally{button.disabled=false;button.textContent=oldText;}
 });
}
submitForm(document.getElementById("f-materials"),"addMaterial",d=>({title:d.title,grade:d.grade,url:d.url,description:d.description}));
submitForm(document.getElementById("f-homework"),"addHomework",d=>({student:d.student,title:d.title,assigned:d.assigned,due:d.due}));
submitForm(document.getElementById("f-schedule"),"addEvent",d=>({date:d.date,time:d.time,type:d.type,title:d.title,description:d.description,student:d.student}));
loadData();
