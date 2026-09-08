/* ============================================================================
   OTTO · Cotizador Empresarial — LÓGICA (herramienta unificada)
     · Tabla: precio de REFERENCIA por usuario (mensual/semestral/anual) +
       servicios activables con checkbox, agrupados por plataforma.
     · 3 tarjetas: precio CONFIGURADO según servicios y usuarios (con descuento
       y ahorro). Desde `threshold` usuarios el precio se mantiene (ilimitado).
     · Exportador: documento formal (formato cotización OTTO APIS) con IVA,
       equivalencia en COP, vigencia, datos de pago y términos.
   Depende de data.js (catálogo y reglas) y terms.js (textos del documento).
   ============================================================================ */

const CURRENCIES = {
  usd: { code: 'USD', prefix: 'US$ ', rate: 1,               dec: 2, texto: 'en dólares'            },
  cop: { code: 'COP', prefix: '$ ',   rate: CONFIG.copRate,  dec: 0, texto: 'en pesos colombianos'  }, // rate se sobreescribe con la TRM
};

// Formato tipo cotización: "US$ 1.260,00" · "$ 3.957.093"
function money(n, cur) {
  const c = CURRENCIES[cur || state.currency];
  const v = (n || 0) * c.rate;
  return c.prefix + new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: c.dec, maximumFractionDigits: c.dec,
  }).format(v);
}
const pctTxt = (f) => Math.round(f * 100) + '%';
const PERIOD_LIST = Object.values(PERIODS); // [mensual, semestral, anual]

// Negrita con **asteriscos** y variables {{campo}} en los textos de terms.js
const mdBold = (s) => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const NUM_WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
                   'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
                   'dieciocho', 'diecinueve', 'veinte'];
const numWord = (n) => (NUM_WORDS[n] ? `${NUM_WORDS[n]} (${n})` : String(n));
const fmtDate = (d) => d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ---- Estado ------------------------------------------------------------------
// Los módulos (`addon`) NO entran por defecto: se activan a mano o solos al
// llegar a `includedFrom` licencias (ver `syncAddons`).
const state = {
  selected: new Set(APPS.filter(a => !a.addon).map(a => a.id)),
  users: 15,
  threshold: ENTERPRISE.threshold,
  currency: 'usd',
  plan: 'annual',    // plan que se imprime en la cotización
  courtesy: false,   // incluir los meses de cortesía del portafolio completo
  showCop: false,    // añadir la columna de equivalencia en COP al cotizar en USD
  trm: null,         // { rate, date } cuando se obtiene la TRM en vivo
};

// Un módulo con `includedFrom` entra solo al alcanzar ese número de licencias y
// sale al bajar de él. Entre medias el usuario lo prende o apaga a mano.
function syncAddons(prevUsers) {
  for (const a of APPS) {
    if (!a.addon || !a.includedFrom || !state.selected.has(a.requires)) continue;
    const was = prevUsers >= a.includedFrom, now = state.users >= a.includedFrom;
    if (now && !was) state.selected.add(a.id);
    if (!now && was) state.selected.delete(a.id);
  }
}

// ---- TRM en vivo (Tasa Representativa del Mercado, Colombia) ------------------
// Fuente: Datos Abiertos Colombia (Socrata). Toma el registro más reciente.
async function fetchTRM() {
  const url = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const rec = data && data[0];
    const val = rec && parseFloat(rec.valor);
    if (val && val > 0) {
      CURRENCIES.cop.rate = val;
      state.trm = { rate: val, date: rec.vigenciadesde };
      render();
    }
  } catch (e) {
    /* sin conexión: se mantiene CONFIG.copRate como respaldo */
  }
  updateTRMNote();
}

function updateTRMNote() {
  const el = document.getElementById('trm-note');
  if (!el) return;
  el.style.display = 'block';
  if (state.trm) {
    el.innerHTML = `💱 TRM en vivo: <b>$${state.trm.rate.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</b> COP/USD · ${fmtDate(new Date(state.trm.date))} · fuente datos.gov.co`;
  } else {
    el.innerHTML = `💱 TRM en línea no disponible · usando tasa de respaldo <b>$${CONFIG.copRate.toLocaleString('es-CO')}</b> COP/USD (editable en data.js)`;
  }
}

// ---- Helpers de negocio ------------------------------------------------------
const appById = (id) => APPS.find(a => a.id === id);
const isPriced = (a) => a.monthly > 0 || a.semiannual > 0 || a.annual > 0;

function selectedApps()  { return APPS.filter(a => state.selected.has(a.id)); }
// Apps que generan cobro (los módulos sin precio se listan como "Incluido").
function billableApps()  { return selectedApps().filter(isPriced); }
// El paquete completo se mide sobre las apps con precio (los módulos no cuentan).
function allAppsSelected() {
  return APPS.filter(isPriced).every(a => state.selected.has(a.id));
}
function listSeat(apps, period) { return apps.reduce((s, a) => s + a[period], 0); }

function volumeDiscount(users) {
  let d = 0;
  for (const t of VOLUME_TIERS) if (users >= t.min) d = t.discount;
  return d;
}
function combinedDiscount(users, isFullBundle) {
  const b = isFullBundle ? BUNDLE_DISCOUNT : 0;
  return 1 - (1 - volumeDiscount(users)) * (1 - b);
}
// Usuarios "facturables": desde el umbral el precio TOPA (ilimitado = se paga 30
// y no sube más). Todo el cálculo usa este valor, así la tabla y las cards se
// congelan al llegar a 30 y no siguen cambiando.
function billedUsers() { return Math.min(state.users, state.threshold); }

// Precio configurado de un conjunto de apps.
function priceFor(apps, users, period, isFullBundle) {
  const seat = listSeat(apps, period);
  const billed = Math.min(users, state.threshold);
  const list = billed * seat; // referencia topada en el umbral
  return {
    price: list * discountFactor(period, isFullBundle),
    unlimited: users >= state.threshold,
    list, billed,
  };
}

// Factor de descuento (volumen + paquete) sobre el valor por usuario.
// El MENSUAL no tiene descuento: solo aplica en semestral y anual.
// Topa en el umbral: desde 30 usuarios el valor por usuario se congela.
function discountFactor(period, isFull) {
  if (period === 'monthly') return 1;
  return 1 - combinedDiscount(billedUsers(), isFull);
}

// Descuento por PERIODO (semestral/anual) frente a pagar el mismo tiempo en mensual.
// Ej.: anual vs (mensual × 12). El mensual es la base (0%).
function periodDiscount(period) {
  const apps = selectedApps();
  const base = listSeat(apps, 'monthly') * PERIODS[period].months; // costo en mensual
  const now = listSeat(apps, period);
  return base > 0 ? 1 - now / base : 0;
}

// Valor unitario de una app en un plan: referencia (mensual × meses) v/s ofertado.
// Es la base de las columnas "Valor unitario mensual / anual" de la cotización.
function unitFor(app, plan, isFull) {
  const m = PERIODS[plan].months;
  const listPeriod = app.monthly * m;
  const offerPeriod = app[plan] * discountFactor(plan, isFull);
  return {
    listPeriod, offerPeriod,
    listMonthly: app.monthly,
    offerMonthly: offerPeriod / m,
    pct: listPeriod > 0 ? 1 - offerPeriod / listPeriod : 0,
  };
}

// ---- Render: tabla de servicios (referencia v/s propuesto + checkable) ------
function renderTable() {
  const isFull = allAppsSelected();

  const cell = (app, on, period) => {
    const ref = app[period];
    if (!isPriced(app)) return `<td><span class="v-inc">Incluido</span></td>`;
    if (!on) return `<td><span class="v-off">${money(ref)}</span></td>`;
    const prop = ref * discountFactor(period, isFull);
    return prop < ref - 0.005
      ? `<td><span class="v-ref">${money(ref)}</span><span class="v-prop">${money(prop)}</span></td>`
      : `<td><span class="v-prop">${money(prop)}</span></td>`;
  };

  const head = `<tr>
    <th class="ta-l">Servicio</th>
    ${PERIOD_LIST.map(p => {
      const pd = periodDiscount(p.key);
      const badge = pd > 0.005
        ? `<span class="th-badge">−${pctTxt(pd)} vs mensual</span>`
        : '<span class="th-badge base">plan base</span>';
      return `<th>${p.label}${badge}<span class="th-sub">ref. / propuesto</span></th>`;
    }).join('')}
  </tr>`;

  // Filas agrupadas por plataforma; los módulos van indentados bajo su app.
  let rows = '';
  for (const pl of Object.values(PLATFORMS)) {
    const group = APPS.filter(a => a.platform === pl.key);
    if (!group.length) continue;
    rows += `<tr class="tr-group"><td class="ta-l" colspan="${PERIOD_LIST.length + 1}">${pl.fullName}</td></tr>`;
    rows += group.map(a => {
      const on = state.selected.has(a.id);
      const parentOff = a.requires && !state.selected.has(a.requires);
      const cells = PERIOD_LIST.map(p => cell(a, on, p.key)).join('');
      const hint = parentOff ? `Requiere ${appById(a.requires).name}`
        : a.includedFrom ? `${a.tag} · se incluye desde ${a.includedFrom} licencias`
        : a.tag;
      return `<tr class="${on ? 'on' : 'off'}${a.addon ? ' addon' : ''}${parentOff ? ' locked' : ''}" data-app="${a.id}">
        <td class="ta-l"><span class="chk ${on ? 'on' : ''}"></span><span class="svc-info"><span class="app-name">${a.name}${a.addon ? '<span class="badge-mod">módulo</span>' : ''}</span><span class="app-tag">${hint}</span></span></td>
        ${cells}
      </tr>`;
    }).join('');
  }

  const apps = selectedApps();
  const totals = PERIOD_LIST.map(p => {
    const ref = listSeat(apps, p.key);
    const prop = ref * discountFactor(p.key, isFull);
    return prop < ref - 0.005
      ? `<td><span class="v-ref">${money(ref)}</span><span class="v-prop">${money(prop)}</span></td>`
      : `<td><span class="v-prop">${money(prop)}</span></td>`;
  }).join('');
  const annualDisc = 1 - discountFactor('annual', isFull);

  document.getElementById('cust-table').innerHTML = `
    <div class="quote-scroll">
      <table class="price-table check">
        <thead>${head}</thead>
        <tbody>${rows}
          <tr class="tr-total"><td class="ta-l">Seleccionados · por usuario (${apps.length} de ${APPS.length})</td>${totals}</tr>
        </tbody>
      </table>
    </div>
    <div class="tbl-caption"><b>Referencia</b> = precio lista por usuario. <b>Propuesto</b> = con descuento (hasta −${pctTxt(annualDisc)} por ${state.users} usuarios${state.users >= state.threshold ? ', ilimitado' : ''}). El <b>mensual no tiene descuento</b>: solo aplica en semestral y anual.</div>`;
}

// ---- Render: 3 tarjetas configuradas ----------------------------------------
function renderCards() {
  const u = state.users, apps = selectedApps(), isFull = allAppsSelected();

  document.getElementById('cards-sub').textContent =
    u >= state.threshold ? `· ${u} usuarios · ilimitado` : `· ${u} usuarios`;
  document.getElementById('cust-users-note').innerHTML =
    u >= state.threshold ? '✓ Modo ilimitado activo (precio fijo)' : `Faltan ${state.threshold - u} usuarios para el modo ilimitado`;

  const addons = apps.filter(a => a.addon);
  const cards = PERIOD_LIST.map(p => {
    const { price, unlimited, list, billed } = priceFor(apps, u, p.key, isFull);
    const disc = list > 0 ? 1 - price / list : 0;
    const pd = periodDiscount(p.key);
    const best = p.key === 'annual';
    return `<div class="emp-card ${best ? 'best' : ''}">
      ${best ? '<div class="emp-badge">Mejor precio</div>' : ''}
      <div class="emp-period">${p.label} ${pd > 0.005 ? `<span class="pd-badge">−${pctTxt(pd)} vs mensual</span>` : ''}</div>
      <div class="emp-price">${money(price)}<small> ${p.short}</small></div>
      <div class="emp-peruser">= ${money(price / billed)} por usuario${unlimited ? ` · base ${state.threshold}` : ` × ${billed}`}</div>
      <div class="emp-list">${disc > 0 ? `Referencia <s>${money(list)}</s> · <b>−${pctTxt(disc)}</b> por servicios/volumen` : 'Sin descuento en mensual'}</div>
      ${list - price > 0.005 ? `<div class="emp-save">Ahorras ${money(list - price)}</div>` : ''}
      <div class="emp-unl">${unlimited ? '∞ Usuarios ilimitados' : `${u} usuarios`}</div>
      ${addons.map(a => `<div class="emp-addon">✓ ${a.name}<span>${a.tag}</span></div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('cust-cards').innerHTML = `<div class="emp-cards">${cards}</div>`;

  // Pie resumen (sobre facturación anual)
  const annual = priceFor(apps, u, 'annual', isFull);
  document.getElementById('cust-foot').innerHTML = `
    <div class="emp-foot">
      ${u >= state.threshold
        ? `Con <b>${u} usuarios</b> tu paquete de ${apps.length} servicios es <b>ilimitado</b>: ${money(annual.price)}/año. Ahorras <b>${money(annual.list - annual.price)}</b> frente a la referencia y cada usuario nuevo entra sin costo.`
        : `Con <b>${u} usuarios</b> pagas ${money(annual.price)}/año por ${apps.length} servicios (−${pctTxt(1 - annual.price / annual.list)}). Al llegar a <b>${state.threshold}</b> usuarios el precio se mantiene fijo: ilimitado.`}
    </div>`;
}

// ---- Render maestro ----------------------------------------------------------
function render() {
  document.getElementById('cust-num').value = state.users;
  document.getElementById('cust-range').value = Math.min(state.users, +document.getElementById('cust-range').max);
  renderTable();
  renderCards();
  updateTRMNote();
}

// ---- Eventos ----------------------------------------------------------------
function bind() {
  const num = document.getElementById('cust-num');
  const range = document.getElementById('cust-range');
  const clamp = (v) => Math.max(1, Math.min(200, v || 1));
  const setUsers = (v) => { const prev = state.users; state.users = clamp(v); syncAddons(prev); render(); };
  num.addEventListener('input', () => setUsers(+num.value));
  range.addEventListener('input', () => setUsers(+range.value));

  document.getElementById('cust-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-app]');
    if (!tr) return;
    const app = appById(tr.dataset.app);
    if (state.selected.has(app.id)) {
      state.selected.delete(app.id);
      // al apagar una app se apagan sus módulos dependientes
      APPS.filter(x => x.requires === app.id).forEach(x => state.selected.delete(x.id));
    } else {
      // un módulo no se puede activar sin su app base
      if (app.requires && !state.selected.has(app.requires)) return;
      state.selected.add(app.id);
    }
    if (state.selected.size === 0) state.selected.add(app.id); // nunca vacío
    render();
  });

  document.querySelectorAll('[data-scroll]').forEach(el =>
    el.addEventListener('click', () => document.getElementById('tool').scrollIntoView({ behavior: 'smooth' })));

  // toggle de moneda USD / COP
  document.querySelectorAll('[data-cur]').forEach(b => b.addEventListener('click', () => {
    state.currency = b.dataset.cur;
    document.querySelectorAll('[data-cur]').forEach(x => x.classList.toggle('on', x.dataset.cur === state.currency));
    if (state.currency === 'cop' && !state.trm) fetchTRM(); // reintenta si aún no hay TRM
    render();
  }));

  // opciones del documento
  const plan = document.getElementById('rc-plan');
  if (plan) plan.addEventListener('change', () => { state.plan = plan.value; });
  const court = document.getElementById('rc-courtesy');
  if (court) court.addEventListener('change', () => { state.courtesy = court.checked; });
  const cop = document.getElementById('rc-showcop');
  if (cop) cop.addEventListener('change', () => { state.showCop = cop.checked; });

  // exportar cotización (PDF vía impresión del navegador)
  document.getElementById('btn-export').addEventListener('click', exportQuote);
}

/* ==========================================================================
   EXPORTAR COTIZACIÓN
   Genera el documento formal (formato OTTO APIS) y abre el diálogo de
   impresión del navegador para guardarlo como PDF.
   Los textos salen de `assets/terms.js`; los precios de `assets/data.js`.
   ========================================================================== */

// El logo se inserta como <img> nueva, así que hay que ESPERAR a que cargue: si
// se llama a print() de inmediato, el navegador captura la página sin la imagen
// y el PDF sale sin el logo de OTTO.
function exportQuote() {
  const box = document.getElementById('print-doc');
  box.innerHTML = buildPrintDoc();

  const prevTitle = document.title;
  document.title = quoteFileName();   // nombre sugerido del PDF
  let fired = false;
  const doPrint = () => {
    if (fired) return;
    fired = true;
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 500);
  };

  const pending = [...box.querySelectorAll('img')].filter(i => !i.complete);
  if (!pending.length) return doPrint();
  let left = pending.length;
  const tick = () => { if (--left === 0) doPrint(); };
  pending.forEach(i => {
    i.addEventListener('load', tick, { once: true });
    i.addEventListener('error', tick, { once: true });
  });
  setTimeout(doPrint, 3000);          // si algo falla, no bloquear la exportación
}

const uiVal = (id) => (document.getElementById(id)?.value || '').trim();

// La cotización se imprime SIEMPRE en la moneda del selector superior. La
// columna de equivalencia en COP es opcional y solo tiene sentido cotizando en
// USD (es la que usan las cotizaciones con valor contractual en dólares).
const copColumn = () => state.currency === 'usd' && state.showCop;

function quoteFileName() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const company = (uiVal('rc-company') || 'OTTO').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '');
  return `${yy}${mm}${dd}_Cotización_${company}_${state.users}Usuarios`;
}

// Plataformas presentes en la selección → "Autodesk Revit y Autodesk Civil 3D"
function platformsText(apps) {
  const names = Object.values(PLATFORMS)
    .filter(p => apps.some(a => a.platform === p.key))
    .map(p => p.fullName);
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names.slice(-1) : (names[0] || 'Autodesk Revit');
}

// Portafolio completo → "ocho (8) aplicaciones para Autodesk Revit y tres (3) para Autodesk Civil 3D"
function portfolioText() {
  const parts = Object.values(PLATFORMS).map(p => {
    const n = APPS.filter(a => a.platform === p.key && isPriced(a)).length;
    return n ? { n, full: p.fullName } : null;
  }).filter(Boolean);
  const txt = parts.map((g, i) => `${numWord(g.n)} ${i === 0 ? 'aplicaciones para ' : 'para '}${g.full}`);
  return txt.length > 1 ? txt.slice(0, -1).join(', ') + ' y ' + txt.slice(-1) : (txt[0] || '');
}

// Suma de todas las apps cotizadas para un periodo: subtotal, IVA y referencia.
function totalsFor(plan) {
  const apps = billableApps(), isFull = allAppsSelected(), billed = billedUsers();
  const items = apps.map(a => ({ app: a, u: unitFor(a, plan, isFull) }));
  const subtotal   = items.reduce((s, i) => s + i.u.offerPeriod * billed, 0);
  const listTotal  = items.reduce((s, i) => s + i.u.listPeriod * billed, 0);
  const listSeatM  = items.reduce((s, i) => s + i.u.listMonthly, 0);
  const offerSeatM = items.reduce((s, i) => s + i.u.offerMonthly, 0);
  const iva = subtotal * CONFIG.iva;
  return { items, billed, subtotal, listTotal, listSeatM, offerSeatM, iva, total: subtotal + iva };
}

// Variables disponibles en los textos de terms.js
function quoteVars() {
  const apps = selectedApps();
  const now = new Date();
  const trmRate = CURRENCIES.cop.rate;
  const trmFecha = state.trm ? fmtDate(new Date(state.trm.date)) : fmtDate(now);
  return {
    cliente:            uiVal('rc-company') || 'el cliente',
    atencion:           uiVal('rc-attn'),
    plataformas:        platformsText(apps),
    portafolio:         portfolioText(),
    plan:               PERIODS[state.plan].label,
    plan_adj:           PERIODS[state.plan].adj,
    usuarios:           String(state.users),
    licencias:          String(billedUsers()),
    moneda:             CURRENCIES[state.currency].code,
    moneda_texto:       CURRENCIES[state.currency].texto,
    iva:                pctTxt(CONFIG.iva),
    fecha:              fmtDate(now),
    vigencia_dias:      String(CONFIG.vigenciaDias),
    vigencia_fecha:     fmtDate(addDays(now, CONFIG.vigenciaDias)),
    trm:                `$${trmRate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COP por US$1`,
    trm_fecha:          trmFecha,
    trm_fuente:         state.trm
      ? `certificada por el Banco de la República para el ${trmFecha}`
      : 'tasa de referencia interna vigente a la fecha de esta cotización',
    cortesia_meses:     String(CONFIG.cortesiaMeses),
    cortesia_meses_txt: numWord(CONFIG.cortesiaMeses),
    titular:            COMPANY.banco.titular,
    banco:              COMPANY.banco.banco,
    tipo_cuenta:        COMPANY.banco.tipoCuenta,
    cuenta:             COMPANY.banco.numeroCuenta,
    correo:             COMPANY.correo,
    telefono:           COMPANY.telefono,
  };
}

// Reemplaza {{variables}} (dos pasadas: una variable puede contener otra) y **negritas**.
function fill(text, vars) {
  let out = String(text == null ? '' : text);
  for (let i = 0; i < 2; i++) {
    out = out.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  }
  // Una sigla que ya termina en punto ("OTTO APIS S.A.S.") no debe duplicarlo
  // cuando la frase de terms.js cierra con punto.
  out = out.replace(/(\b(?:[A-ZÁÉÍÓÚÑ]\.){2,})\./g, '$1');
  return mdBold(out);
}

// Nombre del concepto en la tabla: incorpora los módulos sin costo de la app.
function conceptFor(app, plan) {
  const mods = APPS.filter(x => x.addon && !isPriced(x) && x.requires === app.id && state.selected.has(x.id));
  const base = `${app.name} – Licencia ${PERIODS[plan].adj}`;
  const name = mods.length
    ? `${base} con ${mods.map(m => m.name.replace(app.name + ' ', '')).join(' y ')}`
    : base;
  const detail = [app.tag].concat(mods.map(m => m.tag)).join('. ') + '.';
  return { name, detail };
}

function buildPrintDoc() {
  const V = quoteVars();
  const F = (t) => fill(t, V);
  const P = PERIODS[state.plan];
  const unlimited = state.users >= state.threshold;
  const scope = uiVal('rc-scope');
  const logo = new URL('assets/logo-header.webp', location.href).href;
  const quoteNo = uiVal('rc-number');
  const city = uiVal('rc-city') || COMPANY.ciudad;
  const body = planTable(V, F);

  const sec = (t, inner) => `<div class="sec">${t ? `<h3>${F(t)}</h3>` : ''}${inner}</div>`;
  const par = (t) => `<p>${F(t)}</p>`;
  const appBullets = selectedApps().map(a => `<li><b>${a.name}:</b> ${a.tag}.</li>`).join('');

  const recipient = (V.atencion || uiVal('rc-company')) ? `
    <div class="to">
      <div>Señores:</div>
      ${uiVal('rc-company') ? `<div class="to-name">${uiVal('rc-company')}</div>` : ''}
      ${V.atencion ? `<div>Atn.: ${V.atencion}</div>` : ''}
    </div>` : '';

  // El documento va dentro de una tabla a propósito: `thead` y `tfoot` son los
  // únicos elementos que el navegador REPITE en cada página impresa, así que se
  // usan como margen superior e inferior. Con `@page { margin: 0 }` (que quita
  // el encabezado y el pie del navegador) es la forma de que la segunda página
  // y las siguientes respiren igual que la primera.
  return `
  ${printStyles()}
  <table class="sheet">
  <thead><tr><td><div class="m-top"></div></td></tr></thead>
  <tbody><tr><td class="doc">
    <div class="hd">
      <img src="${logo}" alt="OTTO" onerror="this.outerHTML='<span class=&quot;hd-mark&quot;>OTTO</span>'">
      <div class="hd-r">
        <div>${city} ${V.fecha}</div>
        ${quoteNo ? `<div>Cotización No. ${quoteNo}</div>` : ''}
      </div>
    </div>

    ${recipient}
    <div class="doc-title">${F(COPY.tituloDocumento)}</div>

    ${sec(COPY.descripcion.titulo, par(COPY.descripcion.texto) + `<ul>${appBullets}</ul>`)}
    ${sec(COPY.portal.titulo, par(COPY.portal.texto))}
    ${scope ? sec(COPY.alcance.titulo, par(scope)) : ''}
    ${state.courtesy ? sec(COPY.cortesia.titulo, par(COPY.cortesia.texto)) : ''}

    <div class="meta">
      <div><b>Usuarios:</b> ${state.users}${unlimited ? ' (ilimitado)' : ''}</div>
      <div><b>Plan:</b> ${P.label}</div>
      <div><b>Moneda:</b> ${V.moneda}${copColumn() ? ' (equivalencia informativa en COP)' : ''}</div>
    </div>

    ${body.table}
    ${body.note}
    <div class="callout">${body.summary}</div>

    ${sec(COPY.vigencia.titulo, par(COPY.vigencia.texto))}

    ${sec(COPY.formaPago.titulo, par(COPY.formaPago.texto) + `
      <table class="bank">
        <tr><td>Titular:</td><td><b>${V.titular}</b></td></tr>
        <tr><td>Banco:</td><td><b>${V.banco}</b></td></tr>
        <tr><td>Tipo de cuenta:</td><td><b>${V.tipo_cuenta}</b></td></tr>
        <tr><td>Número de cuenta:</td><td><b>${V.cuenta}</b></td></tr>
      </table>` + par(COPY.formaPago.cierre))}

    <div class="fine">${F(COPY.notaIVA)}</div>

    ${termsBlock(V)}

    <div class="sec">
      <div class="doc-title sm">${F(COPY.aceptacion.titulo)}</div>
      ${par(COPY.aceptacion.texto)}
      ${par(COPY.aceptacion.contacto)}
      <div class="contact">Teléfono: ${V.telefono}<br>Correo: ${V.correo}</div>
    </div>

    <div class="sign">
      <p>Atentamente,</p>
      <div class="sign-sp"></div>
      <div class="sign-n">${COMPANY.firma.nombre}</div>
      <div class="sign-c">${COMPANY.firma.cargo}</div>
    </div>

    <div class="foot">${F(COMPANY.pie)}</div>
  </td></tr></tbody>
  <tfoot><tr><td><div class="m-bot"></div></td></tr></tfoot>
  </table>`;
}

/* --- Tabla de un solo plan (formato cotización 00015) ----------------------
   Concepto · Valor unitario mensual · Valor unitario <plan> · Cant. · Totales.
   Muestra el valor de referencia tachado y el ofertado con su % de descuento. */
function planTable(V, F) {
  const plan = state.plan, P = PERIODS[plan], cur = state.currency;
  const showCop = copColumn();
  const T = totalsFor(plan);
  const unlimited = state.users >= state.threshold;
  const unitCols = plan === 'monthly' ? 1 : 2;

  const rows = T.items.map(({ app, u }) => {
    const c = conceptFor(app, plan);
    const cells = [unitCell(u.listMonthly, u.offerMonthly, u.pct, cur)];
    if (unitCols === 2) cells.push(unitCell(u.listPeriod, u.offerPeriod, u.pct, cur));
    return `<tr>
      <td class="cpt"><b>${c.name}</b><span>${c.detail}</span></td>
      ${cells.join('')}
      <td class="c">${T.billed}</td>
      <td class="r">${money(u.offerPeriod * T.billed, cur)}</td>
      ${showCop ? `<td class="r">${money(u.offerPeriod * T.billed, 'cop')}</td>` : ''}
    </tr>`;
  }).join('');

  const freeCells = (txt) => Array.from({ length: unitCols }, () => `<td class="c inc">${txt}</td>`).join('');
  const freeRow = (concept, detail, qty, txt) => `<tr>
    <td class="cpt"><b>${concept}</b>${detail ? `<span>${detail}</span>` : ''}</td>
    ${freeCells(txt)}
    <td class="c">${qty}</td>
    <td class="r inc">Sin costo</td>
    ${showCop ? '<td class="r inc">Sin costo</td>' : ''}
  </tr>`;

  const sumRow = (label, value, cls = '') => `<tr class="${cls}">
    <td class="cpt">${label}</td>
    <td colspan="${unitCols + 1}"></td>
    <td class="r">${money(value, cur)}</td>
    ${showCop ? `<td class="r">${money(value, 'cop')}</td>` : ''}
  </tr>`;

  const table = `<table class="tbl">
    <thead>
      <tr>
        <th class="ta-l">Concepto</th>
        <th class="c">Valor unitario<br>mensual</th>
        ${unitCols === 2 ? `<th class="c">Valor unitario<br>${P.adj}</th>` : ''}
        <th class="c">Cant.</th>
        <th class="r">Total ${CURRENCIES[cur].code}</th>
        ${showCop ? '<th class="r">Total COP</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${freeRow(F(COPY.portal.filaConcepto), '', '—', 'Incluido')}
      ${state.courtesy ? freeRow(F(COPY.cortesia.filaConcepto), F(COPY.cortesia.filaDetalle), state.users, 'Cortesía') : ''}
      ${sumRow('Subtotal', T.subtotal, 'sum')}
      ${sumRow(`IVA (${V.iva})`, T.iva)}
      ${sumRow('Total a pagar (IVA incluido)', T.total, 'grand')}
    </tbody>
  </table>`;

  // Resumen ejecutivo (una frase con todo lo que cierra la venta).
  const pctTotal = T.listSeatM > 0 ? 1 - T.offerSeatM / T.listSeatM : 0;
  const appNames = T.items.map(i => conceptFor(i.app, plan).name.replace(` – Licencia ${P.adj}`, '')).join(', ');
  const extras = ['portal de gestión de licencias y usuarios incluido']
    .concat(state.courtesy ? [`${numWord(CONFIG.cortesiaMeses)} meses de cortesía sobre el portafolio completo de OTTO APIS`] : []);
  const summary = `<b>Resumen:</b> ${money(T.total, cur)} / ${P.per} (IVA incluido)`
    + (showCop ? ` — equivalente a ${money(T.total, 'cop')} con la TRM de referencia —` : '')
    + ` por ${unlimited
        ? `licencias <b>ilimitadas</b> (facturadas sobre la base de ${state.threshold} usuarios)`
        : `${T.billed} licencias ${P.adjPl}`}`
    + ` de ${appNames}, con ${extras.join(' y ')}.`
    + (pctTotal > 0.005
        ? ` Valor por usuario: ${money(T.offerSeatM, cur)} al mes (−${pctTxt(pctTotal)} frente a ${money(T.listSeatM, cur)}). Ahorro ${P.adj}: ${money(T.listTotal - T.subtotal, cur)}.`
        : ` Valor por usuario: ${money(T.offerSeatM, cur)} al mes.`);

  return { table, summary, note: showCop ? `<div class="fine">${F(COPY.notaTRM)}</div>` : '' };
}

// Celda de valor unitario: referencia tachada + valor ofertado + % de descuento.
function unitCell(list, offer, pct, cur) {
  if (list <= 0) return `<td class="c inc">Incluido</td>`;
  if (pct <= 0.005) return `<td class="c">${money(offer, cur)}</td>`;
  return `<td class="c"><s>${money(list, cur)}</s><b>${money(offer, cur)}</b><em>−${pctTxt(pct)}</em></td>`;
}

// Términos y condiciones — el texto vive en assets/terms.js
function termsBlock(V) {
  const F = (t) => fill(t, V);
  const secs = TERMS.secciones
    .filter(s => !s.only || s.only === state.currency)
    .map(s => {
      const body = s.body.map(b => typeof b === 'string'
        ? `<p>${F(b)}</p>`
        : `<ul>${b.list.map(li => `<li>${F(li)}</li>`).join('')}</ul>`).join('');
      return `<div class="sec">${s.titulo ? `<h3>${F(s.titulo)}</h3>` : ''}${body}</div>`;
    }).join('');
  return `<div class="terms">
    <div class="doc-title sm">${F(TERMS.titulo)}</div>
    ${secs}
  </div>`;
}

// Estilos del documento impreso (van dentro de #print-doc, no afectan la web).
function printStyles() {
  return `<style>
  /* Rejilla de página: thead/tfoot se repiten en cada hoja y hacen de margen. */
  #print-doc .sheet { width:100%; border-collapse:collapse; }
  #print-doc .sheet > thead > tr > td,
  #print-doc .sheet > tfoot > tr > td { padding:0; border:0; }
  #print-doc .m-top { height:15mm; }
  #print-doc .m-bot { height:12mm; }
  #print-doc td.doc { font-family: Poppins, Arial, sans-serif; color:#0b1d3a; font-size:11px;
    line-height:1.55; padding:0 14mm; vertical-align:top; }
  #print-doc .hd { display:flex; justify-content:space-between; align-items:flex-start;
    border-bottom:2px solid #022457; padding-bottom:14px; margin-bottom:18px; }
  #print-doc .hd img { height:36px; width:auto; }
  /* Respaldo por si la imagen del logo no carga */
  #print-doc .hd-mark { font-size:26px; font-weight:800; letter-spacing:-1px; color:#021024; }
  #print-doc .hd-r { text-align:right; font-size:10.5px; color:#5c6b82; }
  #print-doc .to { margin-bottom:14px; }
  #print-doc .to-name { font-weight:700; color:#022457; }
  #print-doc .doc-title { font-size:13px; font-weight:700; color:#022457; letter-spacing:.4px; margin:0 0 14px; }
  #print-doc .doc-title.sm { font-size:12.5px; margin-bottom:10px; }
  #print-doc .sec { margin-bottom:13px; }
  #print-doc .sec h3 { font-size:11px; font-weight:700; color:#022457; margin:0 0 4px; }
  #print-doc p { margin:0 0 7px; text-align:justify; }
  #print-doc ul { margin:0 0 7px 16px; padding:0; }
  #print-doc li { margin-bottom:2px; }
  #print-doc .meta { display:flex; gap:26px; margin:14px 0 8px; font-size:10.5px; }
  #print-doc .tbl { width:100%; border-collapse:collapse; font-size:10px; }
  #print-doc .tbl th { color:#8a97ab; font-weight:500; padding:6px 8px; border-bottom:1px solid #cdd9ea;
    text-align:right; vertical-align:bottom; }
  #print-doc .tbl th.ta-l { text-align:left; }
  #print-doc .tbl th.c { text-align:center; }
  #print-doc .tbl td { padding:7px 8px; border-bottom:1px solid #eef2f7; vertical-align:top; }
  #print-doc .tbl td.c { text-align:center; }
  #print-doc .tbl td.r { text-align:right; }
  #print-doc .tbl td.cpt b { color:#0b1d3a; font-weight:600; display:block; }
  #print-doc .tbl td.cpt span { display:block; color:#5c6b82; font-size:9px; line-height:1.4; }
  #print-doc .tbl td s { display:block; color:#9aa8bd; font-size:9px; }
  #print-doc .tbl td b { font-weight:600; }
  #print-doc .tbl td em { display:block; font-style:normal; color:#1f9d68; font-size:9px; }
  #print-doc .tbl .inc { color:#2f6fe0; }
  #print-doc .tbl tr.sum td { border-top:1px solid #cdd9ea; font-weight:700; }
  #print-doc .tbl tr.grand td { font-weight:700; color:#022457; border-top:1px solid #cdd9ea;
    border-bottom:2px solid #022457; }
  #print-doc .tbl tr.badges td { border-bottom:none; padding:3px 8px 0; color:#1f9d68; font-size:9px; }
  #print-doc .fine { font-size:9px; color:#8a97ab; line-height:1.5; margin-top:6px; text-align:justify; }
  #print-doc .callout { margin:14px 0; background:#f2f6fb; border-left:3px solid #022457;
    border-radius:0 8px 8px 0; padding:10px 13px; font-size:10.5px; line-height:1.55; text-align:justify; }
  #print-doc .bank { border-collapse:collapse; margin:6px 0 9px; font-size:10.5px; }
  #print-doc .bank td { padding:2px 26px 2px 0; color:#5c6b82; }
  #print-doc .bank td b { color:#0b1d3a; }
  #print-doc .contact { margin-top:4px; }
  #print-doc .sign { margin-top:16px; }
  #print-doc .sign-sp { height:42px; }
  #print-doc .sign-n { font-weight:700; color:#022457; }
  #print-doc .sign-c { color:#5c6b82; }
  #print-doc .foot { margin-top:18px; border-top:1px solid #e3e9f2; padding-top:8px;
    font-size:9px; color:#9aa8bd; text-align:center; }
  </style>`;
}

document.addEventListener('DOMContentLoaded', () => { bind(); render(); fetchTRM(); });
