// Registrazione Service Worker per PWA (percorso relativo per GitHub Pages)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrato con successo', reg))
      .catch(err => console.error('Errore SW:', err));
  });
}

const ORE_GIORNO = 8;

/* =========================
   MULTI-USER
   - Dati separati per utente (localStorage)
   - Utenti: Sergio / Mirian / Christian
   ========================= */
const USERS = [
  { id: 'sergio', name: 'Sergio' },
  { id: 'mirian', name: 'Mirian' },
  { id: 'christian', name: 'Christian' },
];

function getActiveUserId() {
  const saved = (localStorage.getItem('activeUserId') || '').trim();
  if (USERS.some(u => u.id === saved)) return saved;
  // default
  localStorage.setItem('activeUserId', USERS[0].id);
  return USERS[0].id;
}

function setActiveUserId(id) {
  if (!USERS.some(u => u.id === id)) return;
  localStorage.setItem('activeUserId', id);
}

function getActiveUserName() {
  const id = getActiveUserId();
  return (USERS.find(u => u.id === id) || USERS[0]).name;
}

function openUserPicker() {
  const current = getActiveUserName();
  const choices = USERS.map(u => u.name).join(' / ');
  const resp = prompt(`Utente (${choices}):`, current);
  if (resp === null) return;
  const name = String(resp).trim().toLowerCase();
  const found = USERS.find(u => u.name.toLowerCase() === name || u.id === name);
  if (!found) return alert('Utente non valido');
  setActiveUserId(found.id);
  location.reload();
}

function storageKey(base) {
  return `${base}__${getActiveUserId()}`;
}

const defaultSettings = {
  residuiAP: { ferie: 36.15000, rol: 64.58249, conto: 2.00000 },
  spettanteAnnuo: { ferie: 216.00000, rol: 62.00000, conto: 0.00000 },
  dataInizioConteggio: "2026-01-01",
  annoRiferimento: 2026
};

/* =========================
   HELPERS (date, festività)
   ========================= */
function isoLocalDate(y, m0, d) {
  const mm = String(m0 + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
function todayLocalISO() {
  const t = new Date();
  return isoLocalDate(t.getFullYear(), t.getMonth(), t.getDate());
}
function toITDate(iso) {
  return new Date(iso).toLocaleDateString('it-IT');
}

// Calcolo Pasqua (Meeus/Jones/Butcher)
function getPasqua(anno) {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, month - 1, day);
}

function getFestivitaNazionaliIT(anno) {
  const fixed = [
    [0, 1], [0, 6], [3, 25], [4, 1], [5, 2],
    [7, 15], [10, 1], [11, 8], [11, 25], [11, 26],
  ].map(([m0, d]) => isoLocalDate(anno, m0, d));

  const pasqua = getPasqua(anno);
  const pasquaISO = isoLocalDate(anno, pasqua.getMonth(), pasqua.getDate());

  const pasquetta = new Date(pasqua);
  pasquetta.setDate(pasqua.getDate() + 1);
  const pasquettaISO = isoLocalDate(anno, pasquetta.getMonth(), pasquetta.getDate());

  return [...fixed, pasquaISO, pasquettaISO];
}

/* =========================
   STORAGE
   ========================= */
function initSettings() {
  // Migrazione: se esistono i vecchi key globali, li copiamo su Sergio al primo avvio
  const sergioSettingsKey = storageKey('userSettings');
  const sergioMovKey = storageKey('movimenti');

  const legacySettings = localStorage.getItem('userSettings');
  const legacyMov = localStorage.getItem('movimenti');

  if (legacySettings && !localStorage.getItem(sergioSettingsKey)) {
    localStorage.setItem(sergioSettingsKey, legacySettings);
  }
  if (legacyMov && !localStorage.getItem(sergioMovKey)) {
    localStorage.setItem(sergioMovKey, legacyMov);
  }

  const k = storageKey('userSettings');
  if (!localStorage.getItem(k)) {
    localStorage.setItem(k, JSON.stringify(defaultSettings));
  }
}

function getSettings() {
  return JSON.parse(localStorage.getItem(storageKey('userSettings'))) || defaultSettings;
}

function getMovimenti() {
  return JSON.parse(localStorage.getItem(storageKey('movimenti'))) || [];
}

function setMovimenti(m) {
  localStorage.setItem('movimenti', JSON.stringify(m));
}

/* =========================
   STATE (edit mode)
   ========================= */
let EDIT_ID = null; // se valorizzato, la modale salva una modifica invece di inserire

function canHavePianificato(tipo) {
  return (tipo === 'ferie' || tipo === 'ferie_az' || tipo === 'rol' || tipo === 'conto');
}

function getPianificatoCheckboxEl() {
  return document.getElementById('soloPianificato') || document.getElementById('in-pianificato');
}
function getPianificatoChecked() {
  const cb = getPianificatoCheckboxEl();
  return cb ? !!cb.checked : false;
}
function setPianificatoChecked(v) {
  const cb = getPianificatoCheckboxEl();
  if (cb) cb.checked = !!v;
}

/* =========================
   INIT
   ========================= */
window.onload = () => {
  initSettings();

  // UI: mostra utente attivo
  const up = document.getElementById('user-pill');
  if (up) {
    const name = getActiveUserName();
    up.innerText = name ? name.charAt(0).toUpperCase() : 'U';
    up.setAttribute('aria-label', `Utente: ${name}`);
  }

  const activePage = document.body.getAttribute('data-page');
  // Titolo Calendario
  if (activePage === 'calendario') {
    const settings = getSettings();
    const annoCorrente = settings.annoRiferimento || new Date().getFullYear();
    const ct = document.getElementById('calendar-title');
    if (ct) ct.textContent = `Calendario ${annoCorrente}`;
  }


  popolaFiltroAnni();

  const fA = document.getElementById('filter-anno');
  const fT = document.getElementById('filter-tipo');
  if (fA) fA.onchange = () => {
    renderizzaTabella(activePage);
    aggiornaInterfaccia(activePage);
    if (activePage === 'calendario') renderizzaCalendario();
  };
  if (fT) fT.onchange = () => {
    renderizzaTabella(activePage);
    aggiornaInterfaccia(activePage);
    if (activePage === 'calendario') renderizzaCalendario();
  };

  aggiornaInterfaccia(activePage);
  if (document.getElementById('history-body')) renderizzaTabella(activePage);
  if (activePage === 'calendario') renderizzaCalendario();

  setupDate();

  // Liquid tab bar indicator (glass)
  initLiquidTabBar();
};

/* =========================
   CALENDARIO (orizzontale)
   ========================= */
function renderizzaCalendario() {
  const tableBody = document.getElementById('calendarBody');
  const tableHeader = document.getElementById('calendarHeader');
  if (!tableBody || !tableHeader) return;

  const mesi = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
  const anno = (getSettings().annoRiferimento || new Date().getFullYear());

  const movimentiAnno = getMovimenti().filter(m => new Date(m.data).getFullYear() === anno);
  const festivi = new Set(getFestivitaNazionaliIT(anno));
  const patrono = `${anno}-12-07`; // Sant'Ambrogio

  tableHeader.innerHTML = '<th class="col-mese">MESE</th>';
  for (let i = 1; i <= 31; i++) tableHeader.innerHTML += `<th>${i}</th>`;
  tableBody.innerHTML = '';

  const sumOre = (arr) => arr.reduce((acc, x) => acc + (Number(x.ore) || 0), 0);
  const hasPian = (arr) => arr.some(x => !!(x.pianificato || x.soloPianificato));

  mesi.forEach((mese, indexMese) => {
    let riga = `<tr><td class="col-mese">${mese}</td>`;

    for (let giorno = 1; giorno <= 31; giorno++) {
      const dt = new Date(anno, indexMese, giorno);
      if (dt.getMonth() !== indexMese) {
        riga += `<td class="bg-empty"></td>`;
        continue;
      }

      const dataISO = isoLocalDate(anno, indexMese, giorno);
      const dow = dt.getDay();

      let classe = "";
      let contenuto = "";

      if (dow === 0 || dow === 6) classe = "bg-weekend";
      if (festivi.has(dataISO) || dataISO === patrono) {
        classe = "bg-festivo";
        if (dataISO === patrono) contenuto = "P";
      }

      const movGiorno = movimentiAnno.filter(m => m.data === dataISO);
      if (movGiorno.length) {
        const mal = movGiorno.filter(m => m.tipo === 'malattia');
        const ferAz = movGiorno.filter(m => m.tipo === 'ferie_az');
        const avis = movGiorno.filter(m => m.tipo === 'avis');
        const ferie = movGiorno.filter(m => m.tipo === 'ferie');
        const rol = movGiorno.filter(m => m.tipo === 'rol');
        const conto = movGiorno.filter(m => m.tipo === 'conto');

        // Priorità: malattia > ferie aziendali > avis > ferie > rol > conto
        if (mal.length) {
          classe = "bg-malattia";
          contenuto = "M";
        } else if (ferAz.length) {
          classe = "bg-ferie-az";
          contenuto = "AZ";
          if (hasPian(ferAz)) classe += " is-pian";
        } else if (avis.length) {
          classe = "bg-avis";
          contenuto = "AV";
        } else if (ferie.length) {
          classe = "bg-ferie";
          const ore = sumOre(ferie);
          contenuto = (Math.abs(ore - 8) < 0.001) ? "F" : String(ore % 1 === 0 ? ore.toFixed(0) : ore.toFixed(1)).replace('.', ',');
          if (hasPian(ferie)) classe += " is-pian";
        } else if (rol.length) {
          classe = "bg-rol";
          const ore = sumOre(rol);
          contenuto = String(ore % 1 === 0 ? ore.toFixed(0) : ore.toFixed(1)).replace('.', ',');
          if (hasPian(rol)) classe += " is-pian";
        } else if (conto.length) {
          classe = "bg-conto";
          const ore = sumOre(conto);
          contenuto = String(ore % 1 === 0 ? ore.toFixed(0) : ore.toFixed(1)).replace('.', ',');
          if (hasPian(conto)) classe += " is-pian";
        }
      }

      riga += `<td class="${classe}">${contenuto}</td>`;
    }

    riga += `</tr>`;
    tableBody.innerHTML += riga;
  });
}

/* =========================
   FILTRI
   ========================= */
function popolaFiltroAnni() {
  const filterAnno = document.getElementById('filter-anno');
  if (!filterAnno) return;

  const movimenti = getMovimenti();
  const settings = getSettings();
  const annoCorrente = settings.annoRiferimento || new Date().getFullYear();
  const anni = movimenti.map(m => new Date(m.data).getFullYear());
  anni.push(annoCorrente);

  const anniUnici = [...new Set(anni)].sort((a, b) => b - a);

  let html = '<option value="all">Tutti gli anni</option>';
  anniUnici.forEach(anno => {
    const selected = (anno === annoCorrente) ? 'selected' : '';
    html += `<option value="${anno}" ${selected}>${anno}</option>`;
  });

  filterAnno.innerHTML = html;
}

/* =========================
   DASHBOARD / CONSUNTIVO
   - Grande: RESTANTI (saldo reale)
   - Piccolo: Prev: RESTANTI - PROGRAMMATO (sempre visibile)
   ========================= */
function aggiornaInterfaccia(page) {
  const movimenti = getMovimenti();
  const settings = getSettings();

  const annoCorrente = settings.annoRiferimento || new Date().getFullYear();

  const filtroAnnoEl = document.getElementById('filter-anno');
  const filtroAnnoVal = filtroAnnoEl ? filtroAnnoEl.value : 'all';

  // Se "all" => per le CARD uso anno corrente
  const annoSelezionato = (filtroAnnoEl && filtroAnnoVal !== 'all')
    ? parseInt(filtroAnnoVal, 10)
    : annoCorrente;

  const isAnnoCorrente = annoSelezionato === annoCorrente;

  let calcoli = {
    ferie: { ap: isAnnoCorrente ? settings.residuiAP.ferie : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.ferie : 0, god: 0, pian: 0 },
    rol:   { ap: isAnnoCorrente ? settings.residuiAP.rol   : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.rol   : 0, god: 0, pian: 0 },
    conto: { ap: isAnnoCorrente ? settings.residuiAP.conto : 0, spet: isAnnoCorrente ? settings.spettanteAnnuo.conto : 0, god: 0, pian: 0 },
    malattia: 0
  };

  movimenti.forEach(m => {
    const annoM = new Date(m.data).getFullYear();
    if (annoM !== annoSelezionato) return;

    const ore = Number(m.ore) || 0;

    if (m.tipo === 'malattia') { calcoli.malattia += ore; return; }

    if (m.tipo.startsWith('mat_')) {
      const cat = m.tipo.split('_')[1];
      if (calcoli[cat]) calcoli[cat].spet += ore;
      return;
    }

    if (m.tipo === 'avis') return;

    const tipoReale = (m.tipo === 'ferie_az') ? 'ferie' : m.tipo;
    if (!calcoli[tipoReale]) return;

    const isPian = !!(m.pianificato || m.soloPianificato);
    if (isPian) calcoli[tipoReale].pian += ore;
    else calcoli[tipoReale].god += ore;
  });

  const fmtGG = (ore) => (ore / ORE_GIORNO).toFixed(2).replace('.', ',') + " gg";

  const setCard = (id, ore) => {
    const el = document.getElementById(id);
    if (el) el.innerText = fmtGG(ore);
  };

  // Prev sempre visibile: Prev = saldo - pian (se nessun pian => uguale al saldo)
  const setCardPrev = (id, saldoOre, pianOre) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = Math.max(0, saldoOre - (pianOre || 0));
    el.innerText = "Prev: " + fmtGG(prev);
  };

  // saldo reale (restanti effettivi)
  const saldoFerie = (calcoli.ferie.ap + calcoli.ferie.spet - calcoli.ferie.god);
  const saldoRol   = (calcoli.rol.ap   + calcoli.rol.spet   - calcoli.rol.god);
  const saldoConto = (calcoli.conto.ap + calcoli.conto.spet - calcoli.conto.god);

  setCard('val-ferie', saldoFerie);
  setCard('val-rol', saldoRol);
  setCard('val-conto', saldoConto);

  // Prev (saldo - pianificato) -> sempre visibile se l'elemento esiste
  const setPrev = (id, saldoOre, pianOre) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ore = (Number(saldoOre) || 0) - (Number(pianOre) || 0);
    el.innerText = "Prev: " + fmtGG(ore);
  };

  setPrev('val-ferie-prev', saldoFerie, calcoli.ferie.pian);
  setPrev('val-rol-prev', saldoRol, calcoli.rol.pian);
  setPrev('val-conto-prev', saldoConto, calcoli.conto.pian);

  // Prev: saldo - pian (sempre)
  setCardPrev('val-ferie-pian', saldoFerie, calcoli.ferie.pian);
  setCardPrev('val-rol-pian',   saldoRol,   calcoli.rol.pian);
  setCardPrev('val-conto-pian', saldoConto, calcoli.conto.pian);

  const elMal = document.getElementById('val-malattia');
  if (elMal) elMal.innerText = fmtGG(calcoli.malattia);

  // Consuntivo (ore)
  const tbody = document.getElementById('consuntivo-body');
  if (tbody) {
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

/* =========================
   REPORT TABLE (✏️ ℹ️ 🗑)
   ========================= */
function renderizzaTabella(page) {
  const mov = getMovimenti();
  const tbody = document.getElementById('history-body');
  if (!tbody) return;

  const fA = document.getElementById('filter-anno')?.value || 'all';
  const fT = document.getElementById('filter-tipo')?.value || 'all';

  let filtered = mov.filter(m => page === 'malattia' ? m.tipo === 'malattia' : m.tipo !== 'malattia');

  if (fA !== 'all') filtered = filtered.filter(m => new Date(m.data).getFullYear().toString() === fA);

  if (fT !== 'all' && page !== 'malattia') {
    filtered = filtered.filter(m =>
      m.tipo === fT ||
      (fT === 'ferie' && m.tipo === 'ferie_az') ||
      (fT === 'maturazione' && m.tipo.startsWith('mat_'))
    );
  }

  tbody.innerHTML = filtered
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(m => {
      let label = m.tipo.replace('mat_', 'MAT. ').toUpperCase();
      if (m.tipo === 'ferie_az') label = "FERIE AZ.";
      if (m.tipo === 'malattia') label = "MALATTIA";
      if (m.tipo === 'avis') label = "AVIS";

      const oreNum = Number(m.ore);
      const oreTxt = (m.tipo === 'avis') ? '-' : (Number.isFinite(oreNum) ? oreNum.toFixed(2) + 'h' : '0.00h');

      const badgeClass = m.tipo.startsWith('mat_') ? 'maturazione' : m.tipo;

      const isPian = !!(m.pianificato || m.soloPianificato) && canHavePianificato(m.tipo);
      const pianTxt = isPian ? ' <span style="color:#8E8E93; font-weight:700;">(P)</span>' : '';

      return `<tr style="border-bottom:0.5px solid #EEE;">
        <td style="padding:12px;">${toITDate(m.data)}</td>
        <td><span class="badge-${badgeClass}">${label}</span>${pianTxt}</td>
        <td style="font-weight:700;">${oreTxt}</td>
        <td class="azioni-cell">
          <div class="azioni-wrap">
            <button class="btn-azione" onclick="modifica(${m.id})" aria-label="Modifica">✏️</button>
            <button class="btn-azione" onclick="info(${m.id})" aria-label="Info">ℹ️</button>
            <button class="btn-azione" onclick="elimina(${m.id})" aria-label="Elimina">🗑️</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

/* =========================
   UI (modal / sheet)
   ========================= */
function toggleModal(s) {
  document.getElementById('add-modal')?.classList.toggle('active', !!s);
  const o = document.getElementById('modal-overlay');
  if (o) o.style.display = s ? 'block' : 'none';

  // se chiudo, resetto la modalità modifica
  if (!s) resetEditMode();

  // se apro in modalità "nuovo", resetto checkbox
  if (s && EDIT_ID === null) setPianificatoChecked(false);
}

function toggleSheet(s) {
  if (s) aggiornaInterfaccia(document.body.getAttribute('data-page'));
  document.getElementById('ios-sheet')?.classList.toggle('active', !!s);
  const o = document.getElementById('overlay-sheet');
  if (o) o.style.display = s ? 'block' : 'none';
}

function setModalHeader(isEdit) {
  const titleEl = document.querySelector('#add-modal .modal-title');
  const actionBtn = document.querySelector('#add-modal .modal-nav button:last-child');
  if (titleEl) titleEl.textContent = isEdit ? 'Modifica Record' : 'Nuovo Record';
  if (actionBtn) actionBtn.textContent = isEdit ? 'Salva' : 'Aggiungi';
}

function resetEditMode() {
  EDIT_ID = null;
  setModalHeader(false);
}

/* =========================
   CONSOLIDA / AZZERA
   ========================= */
function azzeraGoduti() {
  if (!confirm('Consolidare il saldo attuale al 01/01?')) return;

  let s = getSettings();
  const mov = getMovimenti();
  const dInizio = new Date(s.dataInizioConteggio);

  ['ferie', 'rol', 'conto'].forEach(cat => {
    let god = 0, mat = 0;

    mov.forEach(m => {
      if (new Date(m.data) >= dInizio) {
        const o = Number(m.ore) || 0;
        if (m.tipo === 'mat_' + cat) mat += o;
        else if (m.tipo === cat || (cat === 'ferie' && m.tipo === 'ferie_az')) {
          // consolido solo i GODUTI (non pianificati)
          const isPian = !!(m.pianificato || m.soloPianificato);
          if (!isPian) god += o;
        }
      }
    });

    s.residuiAP[cat] = (s.residuiAP[cat] + s.spettanteAnnuo[cat] + mat) - god;
    s.spettanteAnnuo[cat] = (cat === 'conto') ? 0 : (cat === 'ferie' ? 216 : 62);
  });

  s.dataInizioConteggio = new Date().getFullYear() + '-01-01';
  localStorage.setItem('userSettings', JSON.stringify(s));
  location.reload();
}

/* =========================
   SAVE / AUTO ORE
   - usa la stessa modale per inserire e modificare
   ========================= */
function saveData() {
  let t = document.getElementById('in-tipo')?.value;
  let o = parseFloat(document.getElementById('in-ore')?.value);
  const d = document.getElementById('in-data')?.value;
  const note = document.getElementById('in-note') ? (document.getElementById('in-note').value || '') : '';

  if (!d) return alert('Data mancante');
  if (!t) return alert('Tipo mancante');

  if (t === 'maturazione') {
    const res = prompt('Destinazione? (ferie, rol, conto)');
    if (['ferie', 'rol', 'conto'].includes(res)) t = 'mat_' + res;
    else return;
  }

  // Validazione ore: AVIS può essere 0, gli altri > 0
  const oreRichieste = (t !== 'avis');
  if (oreRichieste) {
    if (!Number.isFinite(o) || o <= 0) return alert('Inserisci un numero di ore > 0');
  } else {
    if (!Number.isFinite(o)) o = 0;
  }

  // pianificato si applica solo a ferie/rol/conto/ferie_az
  const pianFlag = getPianificatoChecked();
  const pianificato = canHavePianificato(t) ? pianFlag : false;

  const m = getMovimenti();

  if (EDIT_ID !== null) {
    const idx = m.findIndex(x => x.id === EDIT_ID);
    if (idx < 0) {
      // se per qualche motivo il record non c'è più, ricado su inserimento
      EDIT_ID = null;
    } else {
      m[idx] = { ...m[idx], tipo: t, ore: o, data: d, note, pianificato };
      // pulizia retrocompatibilità
      delete m[idx].soloPianificato;
      setMovimenti(m);
      location.reload();
      return;
    }
  }

  m.push({ tipo: t, ore: o, data: d, note, pianificato, id: Date.now() });
  setMovimenti(m);
  location.reload();
}

function gestisciAutoOre() {
  const t = document.getElementById('in-tipo')?.value;
  const i = document.getElementById('in-ore');
  if (!i || !t) return;

  if (t === 'malattia' || t === 'ferie_az') i.value = 8;
  else if (t === 'avis') i.value = 0;
  else i.value = '';

  // mostra/nasconde checkbox pianificato (se presente)
  const cb = getPianificatoCheckboxEl();
  if (cb) {
    const wrap = cb.closest('.checkbox-row') || cb.closest('.form-row') || cb.parentElement;
    if (wrap) wrap.style.display = canHavePianificato(t) ? 'block' : 'none';
    if (!canHavePianificato(t)) cb.checked = false;
  }
}

/* =========================
   SETTINGS PANEL
   ========================= */
function toggleSettings() {
  const p = document.getElementById('settings-panel');
  if (!p) return;

  p.style.display = p.style.display === 'block' ? 'none' : 'block';

  if (p.style.display === 'block') {
    const s = getSettings();
    const c = document.getElementById('settings-inputs');
    if (!c) return;

    c.innerHTML = '';
    ['ferie', 'rol', 'conto'].forEach(id => {
      c.innerHTML += `<div style="margin-bottom:10px; border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:10px;">
        <div style="font-weight:700; font-size:12px; color:#007AFF;">${id.toUpperCase()}</div>
        <div style="display:flex; gap:8px;">
          <div style="flex:1;">
            <label style="font-size:9px;">RES. AP</label>
            <input type="number" id="set-ap-${id}" value="${s.residuiAP[id]}" step="0.00001" style="width:100%;">
          </div>
          <div style="flex:1;">
            <label style="font-size:9px;">SPET.</label>
            <input type="number" id="set-spet-${id}" value="${s.spettanteAnnuo[id]}" step="0.00001" style="width:100%;">
          </div>
        </div>
      </div>`;
    });

    c.innerHTML += `<button onclick="azzeraGoduti()" style="width:100%; background:#FF3B30; color:white; border:none; padding:12px; border-radius:8px; font-weight:700; margin-top:10px;">CONSOLIDA E AZZERA</button>`;
  }
}

function saveSettings() {
  const s = getSettings();
  ['ferie', 'rol', 'conto'].forEach(c => {
    s.residuiAP[c] = parseFloat(document.getElementById(`set-ap-${c}`)?.value) || 0;
    s.spettanteAnnuo[c] = parseFloat(document.getElementById(`set-spet-${c}`)?.value) || 0;
  });
  localStorage.setItem('userSettings', JSON.stringify(s));
  location.reload();
}

/* =========================
   AZIONI RECORD
   ========================= */
function elimina(id) {
  if (!confirm('Eliminare?')) return;
  const m = getMovimenti();
  setMovimenti(m.filter(x => x.id !== id));
  location.reload();
}

function info(id) {
  const m = getMovimenti();
  const r = m.find(x => x.id === id);
  if (!r) return alert('Record non trovato');

  let label = r.tipo.replace('mat_', 'MAT. ').toUpperCase();
  if (r.tipo === 'ferie_az') label = 'FERIE AZ.';
  if (r.tipo === 'malattia') label = 'MALATTIA';
  if (r.tipo === 'avis') label = 'AVIS';

  const ore = Number(r.ore) || 0;
  const oreTxt = (r.tipo === 'avis') ? '-' : ore.toFixed(2) + 'h';
  const isPian = !!(r.pianificato || r.soloPianificato);
  const pian = isPian ? 'Sì' : 'No';
  const note = (r.note || '').trim();

  alert(
    `Data: ${toITDate(r.data)}\n` +
    `Tipo: ${label}\n` +
    `Ore: ${oreTxt}\n` +
    (canHavePianificato(r.tipo) ? `Pianificato: ${pian}\n` : '') +
    (note ? `Note: ${note}` : '')
  );
}

function modifica(id) {
  const m = getMovimenti();
  const r = m.find(x => x.id === id);
  if (!r) return alert('Record non trovato');

  EDIT_ID = id;
  setModalHeader(true);

  // popola campi
  const tipoEl = document.getElementById('in-tipo');
  const oreEl = document.getElementById('in-ore');
  const dataEl = document.getElementById('in-data');
  const noteEl = document.getElementById('in-note');

  if (tipoEl) tipoEl.value = r.tipo;
  if (dataEl) dataEl.value = r.data;
  if (noteEl) noteEl.value = r.note || '';

  // ore di default coerenti (ma se record ha ore, tengo quelle)
  let oreVal = Number(r.ore);
  if (!Number.isFinite(oreVal)) oreVal = 0;
  if (oreEl) oreEl.value = oreVal;

  const isPian = !!(r.pianificato || r.soloPianificato);
  setPianificatoChecked(canHavePianificato(r.tipo) ? isPian : false);

  gestisciAutoOre(); // aggiorna visibilità checkbox e auto-ore solo se serve
  // se tipo è malattia/ferie_az vogliamo comunque mostrare le ore del record (non sovrascrivere)
  if (oreEl) oreEl.value = oreVal;

  toggleModal(true);
}

/* =========================
   DATE + BACKUP
   ========================= */
function setupDate() {
  const cd = document.getElementById('current-date');
  if (cd) {
    cd.innerText = new Date().toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  const inData = document.getElementById('in-data');
  if (inData) inData.value = todayLocalISO();
}

function exportBackup() {
  const payload = { user: getActiveUserId(), m: getMovimenti(), s: getSettings() };
  const b = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'iWork_Backup.json';
  a.click();
}

function importBackup(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;

  const r = new FileReader();
  r.onload = (x) => {
    const j = JSON.parse(x.target.result);
    const targetUser = (j && j.user && USERS.some(u => u.id === j.user)) ? j.user : getActiveUserId();
    localStorage.setItem(`movimenti__${targetUser}`, JSON.stringify(j.m || []));
    localStorage.setItem(`userSettings__${targetUser}`, JSON.stringify(j.s || defaultSettings));
    location.reload();
  };
  r.readAsText(file);
}


/* =========================
   LIQUID TAB BAR INDICATOR
   ========================= */

function initLiquidTabBar() {
  const bar = document.querySelector('.tab-bar');
  if (!bar) return;

  // assicurati che la tab bar sia relativa (per l'indicatore)
  bar.classList.add('tab-liquid');

  // un solo indicatore
  let indicator = bar.querySelector('.liquid-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'liquid-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    bar.prepend(indicator);
  } else {
    // rimuovi eventuali duplicati
    const all = bar.querySelectorAll('.liquid-indicator');
    if (all.length > 1) all.forEach((el, i) => { if (i > 0) el.remove(); });
    indicator = bar.querySelector('.liquid-indicator');
  }

  const items = Array.from(bar.querySelectorAll('.tab-item'));
  if (!items.length) return;

  // Imposta active in base all'URL (per pagine diverse da index)
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  items.forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href && href === current) a.classList.add('active');
    else a.classList.remove('active');
  });

  const place = () => {
    const active = bar.querySelector('.tab-item.active') || items[0];
    const barRect = bar.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();

    const x = (aRect.left - barRect.left);
    indicator.style.width = aRect.width + 'px';
    indicator.style.height = aRect.height + 'px';
    indicator.style.transform = `translateX(${x}px) translateY(-50%)`;
  };

  // Prima posizione
  place();

  // Aggiorna a resize / rotazione / riapertura da cache iOS
  window.addEventListener('resize', place);
  window.addEventListener('pageshow', place);

  // Se l'utente tocca un tab, aggiorna subito la pill
  items.forEach(a => {
    a.addEventListener('click', () => {
      items.forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      place();
    });
  });
}

