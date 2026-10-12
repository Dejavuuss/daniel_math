const parentUser = requireAuth('parent');
if (parentUser) {
    document.getElementById('parentGreeting').textContent = 'Здравствуйте, ' + parentUser.name;
    document.getElementById('logoutBtn').onclick = logout;
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
        document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));
        document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===btn.dataset.tab));
    }));
}
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function loadParentData() {
    const status = document.getElementById('parentStatus');
    try {
        const data = await apiGet();
        const child = (data.users||[]).find(u=>u.role==='student');
        const childName = child ? child.name : 'ученик';
        const hw = data.homework||[], grades = data.grades||[], events = data.schedule||[];
        const notes = data.lessonNotes||[], achievements = data.achievements||[], messages = data.messages||[];

        const avg = grades.length ? (grades.reduce((s,g)=>s+Number(g.grade||0),0)/grades.length).toFixed(2) : '—';
        document.getElementById('parentStats').innerHTML = `
            <article class="stat-card"><span class="eyebrow">ЗАДАНИЙ</span><strong>${hw.length}</strong><span class="muted small">${esc(childName)}</span></article>
            <article class="stat-card"><span class="eyebrow">НЕ ВЫПОЛНЕНО</span><strong>${hw.filter(h=>h.status!=='done').length}</strong><span class="muted small">домашних заданий</span></article>
            <article class="stat-card"><span class="eyebrow">СРЕДНИЙ БАЛЛ</span><strong>${avg}</strong><span class="muted small">из 5.0</span></article>
            <article class="stat-card"><span class="eyebrow">ЗАНЯТИЙ</span><strong>${notes.length}</strong><span class="muted small">проведено</span></article>`;

        // Progress chart
        const recentGrades = grades.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10);
        document.getElementById('parentProgressChart').innerHTML = recentGrades.length
            ? recentGrades.map(g=>`<div class="progress-bar" style="height:${(Number(g.grade)/5)*100}%" data-label="${esc(g.grade)}" title="${esc(g.subject)}"></div>`).join('')
            : '<p class="muted small" style="text-align:center;width:100%">Нет оценок</p>';

        // Achievements
        document.getElementById('parentAchievements').innerHTML = achievements.length
            ? achievements.slice(-6).map(a=>`<div class="achievement"><div class="achievement-icon">${esc(a.icon||'🏆')}</div><div class="achievement-title">${esc(a.title)}</div><div class="achievement-desc">${esc(a.date)}</div></div>`).join('')
            : '<p class="muted small">Пока нет</p>';

        // Recent lesson notes
        document.getElementById('parentRecentNotes').innerHTML = notes.length
            ? notes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3).map(n=>`<div style="padding:8px 0;border-bottom:1px solid var(--panel-border)"><strong>${esc(n.topic)}</strong><div class="muted small">${esc(n.date)} · ${'★'.repeat(Number(n.rating)||0)}${'☆'.repeat(5-(Number(n.rating)||0))}</div></div>`).join('')
            : '<p class="muted small">Занятий не было</p>';

        // Messages
        const msgs = messages.slice(-3).reverse();
        document.getElementById('parentMessages').innerHTML = msgs.length
            ? msgs.map(m=>`<div class="message ${m.from===parentUser.username?'outgoing':''}"><div class="message-meta">${m.from===parentUser.username?'Кому: '+esc(m.to):'От: '+esc(m.from)}</div><div class="message-text">${esc(m.text)}</div></div>`).join('')
            : '<p class="muted small">Сообщений нет</p>';

        document.getElementById('parentHomework').innerHTML = hw.length ? hw.slice().sort((a,b)=>String(a.due).localeCompare(String(b.due))).map(h=>`<article class="item"><div class="row"><h3>${esc(h.title)}</h3><span class="badge ${h.status==='done'?'done':'pending'}">${h.status==='done'?'✓ Выполнено':'Не выполнено'}</span></div><p class="muted small">Выдано: ${esc(h.assigned)} · Срок: ${esc(h.due)}</p>${h.link?`<a class="resource-link" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer">Открыть материал ↗</a>`:''}</article>`).join('') : '<p class="muted">Домашних заданий пока нет.</p>';

        document.getElementById('parentGrades').innerHTML = grades.length ? `<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Предмет</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody>${grades.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(g=>`<tr><td>${esc(g.date)}</td><td>${esc(g.subject)}</td><td><strong>${esc(g.grade)}</strong></td><td>${esc(g.comment)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Оценок пока нет.</p>';

        document.getElementById('parentNotes').innerHTML = notes.length ? notes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>`<div class="lesson-note"><div class="lesson-note-header"><span class="lesson-note-topic">${esc(n.topic)}</span><span class="lesson-note-meta">${esc(n.date)} · ${esc(n.duration)} мин · <span class="lesson-note-rating">${'★'.repeat(Number(n.rating)||0)}${'☆'.repeat(5-(Number(n.rating)||0))}</span></span></div><div class="lesson-note-text">${esc(n.note)}</div></div>`).join('') : '<p class="muted">Заметок пока нет.</p>';

        document.getElementById('parentSchedule').innerHTML = events.length ? events.slice().sort((a,b)=>(String(a.date)+String(a.time)).localeCompare(String(b.date)+String(b.time))).map(ev=>`<article class="item"><div class="row"><h3>${esc(ev.title)}</h3><span class="badge">${esc(ev.type)}</span></div><p class="muted small">${esc(ev.date)} ${esc(ev.time||'')}</p><p>${esc(ev.description||'')}</p></article>`).join('') : '<p class="muted">Событий пока нет.</p>';

        document.getElementById('parentMaterials').innerHTML = (data.materials||[]).length ? data.materials.map(m=>`<article class="item"><h3>${esc(m.title)}</h3>${m.topic?`<p class="muted small">📚 ${esc(m.topic)}</p>`:''}<p class="muted">${esc(m.description||'')}</p>${m.url?`<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Открыть ↗</a>`:''}</article>`).join('') : '<p class="muted">Материалов пока нет.</p>';

        status.textContent = '● Данные синхронизированы';
    } catch(e) { status.textContent = 'Ошибка: ' + e.message; }
}
loadParentData();