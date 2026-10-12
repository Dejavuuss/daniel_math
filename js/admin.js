const adminUser = requireAuth("admin");
let state = {users:[],materials:[],homework:[],schedule:[],grades:[],lessonNotes:[],payments:[],achievements:[],messages:[],topics:[],settings:{}};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

document.getElementById("logoutBtn").onclick = logout;
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===btn.dataset.tab));
}));

function showToast(msg, isError=false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

async function loadData() {
    const status=document.getElementById("adminStatus");
    status.textContent="Загружаем данные…";
    try {
        state = await apiGet();
        fillStudents();
        renderLists();
        document.getElementById("statStudents").textContent = state.users.filter(u=>u.role==="student").length;
        document.getElementById("statHomework").textContent = state.homework.length;
        document.getElementById("statMaterials").textContent = state.materials.length;
        document.getElementById("statLessons").textContent = state.lessonNotes.length;
        status.textContent="● Синхронизировано с Google Sheets";
    } catch(e) { status.textContent="Ошибка: "+e.message; }
}

function fillStudents() {
    const opts = state.users.filter(u=>u.role==="student").map(u=>`<option value="${esc(u.username)}">${esc(u.name)} (${esc(u.username)})</option>`).join("");
    ["studentSelect","eventStudent","gradeStudent","parentChild","noteStudent","payStudent","achStudent"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = (id === "eventStudent" ? '<option value="">Все ученики</option>' : '') + opts;
    });
    const allUsers = state.users.filter(u=>u.role!=="admin").map(u=>`<option value="${esc(u.username)}">${esc(u.name)}</option>`).join("");
    const msgTo = document.getElementById("msgTo");
    if (msgTo) msgTo.innerHTML = allUsers;
}

function table(rows, fields, sheet) {
    if(!rows.length) return '<p class="muted">Записей пока нет.</p>';
    return `<div class="table-wrap"><table><thead><tr>${fields.map(f=>`<th>${f[1]}</th>`).join("")}<th>Действие</th></tr></thead><tbody>${rows.map(r=>`<tr>${fields.map(f=>`<td>${f[0]==="link" && r[f[0]] ? `<a href="${esc(r[f[0]])}" target="_blank" rel="noopener noreferrer">↗</a>` : esc(r[f[0]])}</td>`).join("")}<td>${sheet === "users" ? "—" : `<button class="danger" data-delete-sheet="${sheet}" data-delete-id="${esc(r.id)}">Удалить</button>`}</td></tr>`).join("")}</tbody></table></div>`;
}

function ratingStars(n) {
    return '★'.repeat(Math.max(0,Math.min(5,n||0))) + '☆'.repeat(5 - Math.max(0,Math.min(5,n||0)));
}

function renderLists() {
    document.getElementById("l-materials").innerHTML = table(state.materials,[["title","Название"],["grade","Класс"],["topic","Тема"],["url","Ссылка"]],"materials");
    document.getElementById("l-homework").innerHTML = table(state.homework,[["student","Ученик"],["title","Задание"],["assigned","Выдано"],["due","Дедлайн"],["status","Статус"],["link","Ссылка"]],"homework");
    document.getElementById("l-schedule").innerHTML = table(state.schedule,[["date","Дата"],["time","Время"],["type","Тип"],["title","Событие"],["student","Ученик"]],"schedule");
    document.getElementById("l-grades").innerHTML = table(state.grades||[],[["student","Ученик"],["subject","Предмет"],["grade","Оценка"],["date","Дата"],["comment","Комментарий"]],"grades");
    document.getElementById("l-parents").innerHTML = table((state.users||[]).filter(u=>u.role==="parent"),[["name","Родитель"],["username","Логин"],["child","Ученик"]],"users");
    document.getElementById("l-notes").innerHTML = state.lessonNotes.length
        ? state.lessonNotes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>`<div class="lesson-note"><div class="lesson-note-header"><span class="lesson-note-topic">${esc(n.topic)}</span><span class="lesson-note-meta">${esc(n.date)} · ${esc(n.duration)} мин · <span class="lesson-note-rating">${ratingStars(n.rating)}</span></span></div><div class="lesson-note-meta" style="margin-bottom:8px">Ученик: <strong>${esc(n.student)}</strong></div><div class="lesson-note-text">${esc(n.note)}</div></div>`).join("")
        : '<p class="muted">Заметок пока нет.</p>';
    document.getElementById("l-payments").innerHTML = table(state.payments,[["student","Ученик"],["date","Дата"],["amount","Сумма"],["type","Тип"],["description","Описание"]],"payments");
    document.getElementById("l-achievements").innerHTML = state.achievements.length
        ? state.achievements.map(a=>`<div class="item"><div class="row"><h3>${esc(a.icon||'🏆')} ${esc(a.title)}</h3><span class="badge gold">${esc(a.date)}</span></div><p class="muted">${esc(a.description||'')}</p><p class="small">Ученик: ${esc(a.student)}</p></div>`).join("")
        : '<p class="muted">Достижений пока нет.</p>';
    document.getElementById("l-messages").innerHTML = state.messages.length
        ? state.messages.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(m=>`<div class="message ${m.from===adminUser.username?'outgoing':''} ${m.isRead==='true'||m.from===adminUser.username?'':'unread'}"><div class="message-meta">${m.from===adminUser.username?'Кому: '+esc(m.to):'От: '+esc(m.from)} · ${esc(m.date)}</div><div class="message-text">${esc(m.text)}</div></div>`).join("")
        : '<p class="muted">Сообщений нет.</p>';

    document.querySelectorAll("[data-delete-sheet]").forEach(btn=>btn.onclick=async()=>{
        if(!confirm("Удалить эту запись?"))return;
        const sheet=btn.dataset.deleteSheet,id=btn.dataset.deleteId;
        try { await apiPost({action:"deleteRow",sheet,id}); await loadData(); showToast('Удалено'); }
        catch(e){ showToast('Не удалось удалить: '+e.message, true); }
    });
}

function formData(form){const o={};new FormData(form).forEach((v,k)=>o[k]=v);return o;}

async function submitForm(form, action, map) {
    form.addEventListener("submit", async e=>{
        e.preventDefault();
        const button=form.querySelector('button[type="submit"]'), oldText=button.textContent;
        button.disabled=true; button.textContent="Сохраняем…";
        try {
            await apiPost(Object.assign({action}, map(formData(form))));
            form.reset();
            await loadData();
            showToast('Сохранено');
        } catch(err) { showToast("Не удалось: "+err.message, true); }
        finally { button.disabled=false; button.textContent=oldText; }
    });
}

submitForm(document.getElementById("f-materials"),"addMaterial",d=>({title:d.title,grade:d.grade,url:d.url,description:d.description,topic:d.topic,type:d.type}));
submitForm(document.getElementById("f-homework"),"addHomework",d=>({student:d.student,title:d.title,assigned:d.assigned,due:d.due,link:d.link,comment:d.comment}));
submitForm(document.getElementById("f-schedule"),"addEvent",d=>({date:d.date,time:d.time,type:d.type,title:d.title,description:d.description,student:d.student}));
submitForm(document.getElementById("f-grades"),"addGrade",d=>({student:d.student,subject:d.subject,grade:d.grade,date:d.date,comment:d.comment}));
submitForm(document.getElementById("f-parents"),"addParent",d=>({name:d.name,username:d.username,password:d.password,child:d.child}));
submitForm(document.getElementById("f-notes"),"addLessonNote",d=>({date:d.date,student:d.student,topic:d.topic,note:d.note,rating:d.rating,duration:d.duration}));
submitForm(document.getElementById("f-payments"),"addPayment",d=>({date:d.date,student:d.student,amount:d.amount,type:d.type,description:d.description}));
submitForm(document.getElementById("f-achievements"),"addAchievement",d=>({date:d.date,student:d.student,title:d.title,description:d.description,icon:d.icon}));
submitForm(document.getElementById("f-messages"),"addMessage",d=>({to:d.to,text:d.text}));

loadData();