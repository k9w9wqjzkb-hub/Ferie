if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log("iWork: Pronto per l'uso offline"))
    .catch((err) => console.log("Errore SW:", err));
}

// ... resto del codice ...
const ORE_GIORNO = 8;
const defaultSettings = {
    residuiAP: { ferie: 36.15000, rol: 64.58249, conto: 2.00000 },
    spettanteAnnuo: { ferie: 216.00000, rol: 62.00000, conto: 0.00000 },
    dataInizioConteggio: "2026-01-01",
    annoRiferimento: 2026
};

window.onload = () => {
    initSettings();
    const activePage = document.body.getAttribute('data-page');
    popolaFiltroAnni();
    
    const fA = document.getElementById('filter-anno');
    const fT = document.getElementById('filter-tipo');
    if(fA) fA.onchange = () => { renderizzaTabella(activePage); aggiornaInterfaccia(activePage); };
    if(fT) fT.onchange = () => { renderizzaTabella(activePage); aggiornaInterfaccia(activePage); };

    aggiornaInterfaccia(activePage); 
    if (document.getElementById('history-body')) renderizzaTabella(activePage);
    setupDate();
};

function initSettings() {
    if (!localStorage.getItem('userSettings')) {
        localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
    }
}

function getSettings() { return JSON.parse(localStorage.getItem('userSettings')) || defaultSettings; }

function popolaFiltroAnni() {
    const filterAnno = document.getElementById('filter-anno');
    if (!filterAnno) return;
    const movimenti = JSON.parse(localStorage.getItem('movimenti')) || [];
    const anni = movimenti.map(m => new Date(m.data).getFullYear());
    anni.push(new Date().getFullYear());
    const anniUnici = [...new Set(anni)].sort((a, b) => b - a);
    
    let html = (document.body.getAttribute('data-page') === 'malattia') ? '<option value="all">Tutti gli anni</option>' : '';
    anniUnici.forEach(anno => {
        const selected = (anno === new Date().getFullYear()) ? 'selected' : '';
        html += `<option value="${anno}" ${selected}>${anno}</option>`;
    });
    filterAnno.innerHTML = html;
}

function aggiornaInterfaccia(page) {
    const movimenti = JSON.parse(localStorage.getItem('movimenti')) || [];
    const settings = getSettings();
    const filtroAnnoEl = document.getElementById('filter-anno');
    const annoSelezionato = (filtroAnnoEl && filtroAnnoEl.value !== 'all') ? parseInt(filtroAnnoEl.value) : new Date().getFullYear();
    const isAnnoCorrente = annoSelezionato === new Date().getFullYear();

    let calcoli = {
        ferie: { ap: isAnnoCorrente ? settings.residuiAP.ferie : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.ferie : 0, god: 0, pian: 0 },
        rol: { ap: isAnnoCorrente ? settings.residuiAP.rol : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.rol : 0, god: 0, pian: 0 },
        conto: { ap: isAnnoCorrente ? settings.residuiAP.conto : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.conto : 0, god: 0, pian: 0 },
        malattia: 0
    };

    movimenti.forEach(m => {
        const dataM = new Date(m.data);
        const annoM = dataM.getFullYear();
        const ore = parseFloat(m.ore) || 0;

        if (annoM === annoSelezionato || (filtroAnnoEl?.value === 'all' && m.tipo === 'malattia')) {
            if (m.tipo === 'malattia') {
                calcoli.malattia += ore;
            } else if (m.tipo.startsWith('mat_')) {
                const cat = m.tipo.split('_')[1];
                if(calcoli[cat]) calcoli[cat].spet += ore;
            } else if (m.tipo !== 'avis') {
                let tipoReale = (m.tipo === 'ferie_az') ? 'ferie' : m.tipo;
                if (calcoli[tipoReale]) {
                    if (m.pianificato) calcoli[tipoReale].pian += ore;
                    else calcoli[tipoReale].god += ore;
                }
            }
        }
    });

    const setCard = (id, obj) => { 
        const el = document.getElementById(id);
        if(!el) return;
        const attuale = (obj.ap + obj.spet - obj.god) / ORE_GIORNO;
        const prev = attuale - (obj.pian / ORE_GIORNO);
        el.innerHTML = `
            <div style="font-size:22px; font-weight:700;">${attuale.toFixed(2).replace('.', ',')}</div>
            <div style="font-size:11px; color:#8E8E93; font-weight:400; margin-top:2px;">Prev: ${prev.toFixed(2).replace('.', ',')} gg</div>
        `;
    };
    
    setCard('val-ferie', calcoli.ferie);
    setCard('val-rol', calcoli.rol);
    setCard('val-conto', calcoli.conto);
    
    const elMal = document.getElementById('val-malattia');
    if(elMal) elMal.innerText = (calcoli.malattia / ORE_GIORNO).toFixed(2).replace('.', ',') + " gg";

    const tbody = document.getElementById('consuntivo-body');
    if(tbody) {
        tbody.innerHTML = '';
        ['ferie', 'rol', 'conto'].forEach(id => {
            const c = calcoli[id];
            const saldo = c.ap + c.spet - c.god;
            tbody.innerHTML += `<tr>
                <td style="padding:10px;">${id.toUpperCase()}</td>
                <td style="text-align:center;">${c.ap.toFixed(2)}</td>
                <td style="text-align:center;">${c.spet.toFixed(2)}</td>
                <td style="text-align:center;">${c.god.toFixed(2)}</td>
                <td style="text-align:right; font-weight:700;">${saldo.toFixed(2)}</td>
            </tr>`;
        });
    }
}

function renderizzaTabella(page) {
    const mov = JSON.parse(localStorage.getItem('movimenti')) || [];
    const tbody = document.getElementById('history-body');
    if(!tbody) return;
    const fA = document.getElementById('filter-anno')?.value || 'all';
    const fT = document.getElementById('filter-tipo')?.value || 'all';

    let filtered = mov.filter(m => page === 'malattia' ? m.tipo === 'malattia' : m.tipo !== 'malattia');
    if (fA !== 'all') filtered = filtered.filter(m => new Date(m.data).getFullYear().toString() === fA);
    if (fT !== 'all' && page !== 'malattia') {
        filtered = filtered.filter(m => m.tipo === fT || (fT === 'ferie' && m.tipo === 'ferie_az') || (fT === 'maturazione' && m.tipo.startsWith('mat_')));
    }
    
    tbody.innerHTML = filtered.sort((a,b)=>new Date(b.data)-new Date(a.data)).map(m => {
        let label = m.tipo.replace('mat_', 'MAT. ').toUpperCase();
        if(m.tipo === 'ferie_az') label = "FERIE AZ.";
        const pianBadge = m.pianificato ? '<span style="font-size:9px; color:#FF9500; font-weight:bold; margin-left:5px;">●</span>' : '';
        
        return `<tr style="border-bottom:0.5px solid #EEE; ${m.pianificato ? 'background:#FDFDFD; opacity:0.8;' : ''}">
            <td style="padding:12px;">${new Date(m.data).toLocaleDateString()}</td>
            <td><span class="badge-${m.tipo.startsWith('mat_')?'maturazione':m.tipo}">${label}</span>${pianBadge}</td>
            <td style="font-weight:700;">${m.tipo==='avis'?'-':m.ore.toFixed(2)+'h'}</td>
            <td style="text-align:right; padding-right:12px;">
                <button onclick="avviaModifica(${m.id})" style="border:none; background:none; font-size:16px; padding:5px;">✏️</button>
                <button onclick="elimina(${m.id})" style="border:none; background:none; font-size:16px; padding:5px;">🗑️</button>
            </td></tr>`;
    }).join('');
}

function toggleEditModal(s) {
    const mod = document.getElementById('edit-modal');
    if(mod) {
        mod.classList.toggle('active', s);
        document.getElementById('edit-modal-overlay').style.display = s ? 'block' : 'none';
    }
}

function avviaModifica(id) {
    const mov = JSON.parse(localStorage.getItem('movimenti')) || [];
    const item = mov.find(m => m.id === id);
    if (!item) return;

    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-tipo').value = item.tipo;
    document.getElementById('edit-ore').value = item.ore;
    document.getElementById('edit-data').value = item.data;
    document.getElementById('edit-note').value = item.note || "";
    document.getElementById('edit-pianificato').checked = item.pianificato || false;

    toggleEditModal(true);
}

function updateData() {
    const id = parseInt(document.getElementById('edit-id').value);
    let mov = JSON.parse(localStorage.getItem('movimenti')) || [];
    const index = mov.findIndex(m => m.id === id);
    if (index === -1) return;

    mov[index].tipo = document.getElementById('edit-tipo').value;
    mov[index].ore = parseFloat(document.getElementById('edit-ore').value) || 0;
    mov[index].data = document.getElementById('edit-data').value;
    mov[index].note = document.getElementById('edit-note').value;
    mov[index].pianificato = document.getElementById('edit-pianificato').checked;

    localStorage.setItem('movimenti', JSON.stringify(mov));
    location.reload();
}

function saveData() {
    let t = document.getElementById('in-tipo').value;
    let o = parseFloat(document.getElementById('in-ore').value);
    let d = document.getElementById('in-data').value;
    let n = document.getElementById('in-note').value;
    let p = document.getElementById('in-pianificato').checked;

    if(!d) return alert("Data mancante");
    if(t === 'maturazione') {
        const res = prompt("Destinazione? (ferie, rol, conto)");
        if(['ferie','rol','conto'].includes(res)) t = 'mat_'+res; else return;
    }
    const m = JSON.parse(localStorage.getItem('movimenti')) || [];
    m.push({tipo:t, ore:o||0, data:d, note:n, pianificato:p, id: Date.now()});
    localStorage.setItem('movimenti', JSON.stringify(m));
    location.reload();
}

function gestisciAutoOre() {
    const t = document.getElementById('in-tipo').value;
    const i = document.getElementById('in-ore');
    if (t === 'malattia' || t === 'ferie_az') i.value = 8; else if (t === 'avis') i.value = 0; else i.value = "";
}

function toggleModal(s) { document.getElementById('add-modal').classList.toggle('active', s); document.getElementById('modal-overlay').style.display = s ? 'block' : 'none'; }
function toggleSheet(s) { if(s) aggiornaInterfaccia(); document.getElementById('ios-sheet').classList.toggle('active', s); document.getElementById('overlay-sheet').style.display = s ? 'block' : 'none'; }

function toggleSettings() {
    const p = document.getElementById('settings-panel');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
    if(p.style.display === 'block') {
        const s = getSettings();
        const c = document.getElementById('settings-inputs');
        c.innerHTML = '';
        ['ferie', 'rol', 'conto'].forEach(id => {
            c.innerHTML += `<div style="margin-bottom:10px; border-bottom:1px solid #EEE; padding-bottom:10px;">
                <div style="font-weight:700; font-size:12px; color:#007AFF;">${id.toUpperCase()}</div>
                <div style="display:flex; gap:8px;">
                    <div style="flex:1;"><label style="font-size:9px;">RES. AP</label><input type="number" id="set-ap-${id}" value="${s.residuiAP[id]}" step="0.00001" style="width:100%;"></div>
                    <div style="flex:1;"><label style="font-size:9px;">SPET.</label><input type="number" id="set-spet-${id}" value="${s.spettanteAnnuo[id]}" step="0.00001" style="width:100%;"></div>
                </div>
            </div>`;
        });
        c.innerHTML += `<button onclick="azzeraGoduti()" style="width:100%; background:#FF3B30; color:white; border:none; padding:12px; border-radius:8px; font-weight:700; margin-top:10px;">CONSOLIDA E AZZERA</button>`;
    }
}
function saveSettings() {
    const s = getSettings();
    ['ferie', 'rol', 'conto'].forEach(c => {
        s.residuiAP[c] = parseFloat(document.getElementById(`set-ap-${c}`).value) || 0;
        s.spettanteAnnuo[c] = parseFloat(document.getElementById(`set-spet-${c}`).value) || 0;
    });
    localStorage.setItem('userSettings', JSON.stringify(s));
    location.reload();
}
function elimina(id) { if(confirm("Eliminare?")) { const m = JSON.parse(localStorage.getItem('movimenti')); localStorage.setItem('movimenti', JSON.stringify(m.filter(x=>x.id!==id))); location.reload(); } }
function setupDate() { if(document.getElementById('current-date')) document.getElementById('current-date').innerText = new Date().toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'}); if(document.getElementById('in-data')) document.getElementById('in-data').value = new Date().toISOString().split('T')[0]; }
function exportBackup() { const b = new Blob([JSON.stringify({m:JSON.parse(localStorage.getItem('movimenti')), s:getSettings()})], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download='iWork_Backup.json'; a.click(); }
function importBackup(e) { const r = new FileReader(); r.onload=(x)=>{const j=JSON.parse(x.target.result); localStorage.setItem('movimenti', JSON.stringify(j.m)); localStorage.setItem('userSettings', JSON.stringify(j.s)); location.reload();}; r.readAsText(e.target.files[0]); }