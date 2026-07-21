/* ============================================================================
   OTTO · Cotizador Empresarial — LÓGICA (herramienta unificada)
     · Tabla: precio de REFERENCIA por usuario (mensual/semestral/anual) +
       servicios activables con checkbox.
     · 3 tarjetas: precio CONFIGURADO según servicios y usuarios (con descuento
       y ahorro). Desde `threshold` usuarios el precio se mantiene (ilimitado).
   Depende de data.js (APPS, PERIODS, ENTERPRISE, VOLUME_TIERS, BUNDLE_DISCOUNT).
   ============================================================================ */

const CURRENCIES = {
  usd: { code: 'USD', locale: 'en-US', rate: 1 },
  cop: { code: 'COP', locale: 'es-CO', rate: CONFIG.copRate }, // se sobreescribe con la TRM en vivo
};
function money(n) {
  const c = CURRENCIES[state.currency];
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code, maximumFractionDigits: 0 })
    .format(Math.round(n * c.rate));
}
const pctTxt = (f) => Math.round(f * 100) + '%';
const PERIOD_LIST = Object.values(PERIODS); // [mensual, semestral, anual]

// ---- Estado ------------------------------------------------------------------
const state = {
  selected: new Set(APPS.map(a => a.id)),
  users: 15,
  threshold: ENTERPRISE.threshold,
  currency: 'usd',
  trm: null, // { rate, date } cuando se obtiene la TRM en vivo
};

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
      if (state.currency === 'cop') render();
    }
  } catch (e) {
    /* sin conexión: se mantiene CONFIG.copRate como respaldo */
  }
  updateTRMNote();
}

function updateTRMNote() {
  const el = document.getElementById('trm-note');
  if (!el) return;
  if (state.currency !== 'cop') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (state.trm) {
    const d = new Date(state.trm.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    el.innerHTML = `💱 TRM en vivo: <b>$${state.trm.rate.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</b> COP/USD · ${d} · fuente datos.gov.co`;
  } else {
    el.innerHTML = `💱 TRM en línea no disponible · usando tasa de respaldo <b>$${CONFIG.copRate.toLocaleString('es-CO')}</b> COP/USD (editable en data.js)`;
  }
}

// ---- Helpers de negocio ------------------------------------------------------
function selectedApps()    { return APPS.filter(a => state.selected.has(a.id)); }
function allAppsSelected() { return state.selected.size === APPS.length; }
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

// Factor aplicado al valor por usuario (referencia → propuesto), dinámico.
// < umbral: descuento por volumen/paquete. >= umbral: reparto del precio ilimitado
// entre los usuarios reales (el valor por usuario sigue bajando al crecer el equipo).
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
  const monthsCovered = 12 / PERIODS[period].factor;      // mensual=1, semestral=6, anual=12
  const base = listSeat(apps, 'monthly') * monthsCovered;  // lo que costaría en mensual
  const now = listSeat(apps, period);
  return base > 0 ? 1 - now / base : 0;
}

// ---- Render: tabla de servicios (referencia v/s propuesto + checkable) ------
function renderTable() {
  const isFull = allAppsSelected();

  const cell = (ref, on, period) => {
    if (!on) return `<td><span class="v-off">${money(ref)}</span></td>`;
    const prop = ref * discountFactor(period, isFull);
    return prop < ref - 0.5
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

  const rows = APPS.map(a => {
    const on = state.selected.has(a.id);
    const cells = PERIOD_LIST.map(p => cell(a[p.key], on, p.key)).join('');
    return `<tr class="${on ? 'on' : 'off'}" data-app="${a.id}">
      <td class="ta-l"><span class="chk ${on ? 'on' : ''}"></span><span class="svc-info"><span class="app-name">${a.name}</span><span class="app-tag">${a.tag}</span></span></td>
      ${cells}
    </tr>`;
  }).join('');

  const apps = selectedApps();
  const totals = PERIOD_LIST.map(p => cell(listSeat(apps, p.key), true, p.key)).join('');
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

  const hasBEP = state.selected.has('bep-revisor');
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
      ${list - price > 0.5 ? `<div class="emp-save">Ahorras ${money(list - price)}</div>` : ''}
      <div class="emp-unl">${unlimited ? '∞ Usuarios ilimitados' : `${u} usuarios`}</div>
      ${hasBEP && unlimited ? '<div class="emp-addon">✓ Reporte en lote (BEP Revisor)<span>Revisa varios modelos y genera un Excel a detalle</span></div>' : ''}
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
}

// ---- Eventos ----------------------------------------------------------------
function bind() {
  const num = document.getElementById('cust-num');
  const range = document.getElementById('cust-range');
  const clamp = (v) => Math.max(1, Math.min(200, v || 1));
  num.addEventListener('input', () => { state.users = clamp(+num.value); render(); });
  range.addEventListener('input', () => { state.users = clamp(+range.value); render(); });

  document.getElementById('cust-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-app]');
    if (!tr) return;
    const id = tr.dataset.app;
    if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    if (state.selected.size === 0) state.selected.add(id); // nunca vacío
    render();
  });

  document.querySelectorAll('[data-scroll]').forEach(el =>
    el.addEventListener('click', () => document.getElementById('tool').scrollIntoView({ behavior: 'smooth' })));

  // toggle de moneda USD / COP
  document.querySelectorAll('[data-cur]').forEach(b => b.addEventListener('click', () => {
    state.currency = b.dataset.cur;
    document.querySelectorAll('[data-cur]').forEach(x => x.classList.toggle('on', x.dataset.cur === state.currency));
    if (state.currency === 'cop' && !state.trm) fetchTRM(); // reintenta si aún no hay TRM
    updateTRMNote();
    render();
  }));

  // exportar cotización (PDF vía impresión del navegador)
  document.getElementById('btn-export').addEventListener('click', exportQuote);
}

// ---- Exportar cotización -----------------------------------------------------
function exportQuote() {
  document.getElementById('print-doc').innerHTML = buildPrintDoc();
  window.print();
}

function buildPrintDoc() {
  const u = state.users, apps = selectedApps(), isFull = allAppsSelected();
  const billed = billedUsers();
  const unlimited = u >= state.threshold;
  const hasBEP = state.selected.has('bep-revisor');
  const date = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const logo = new URL('assets/logo-header.webp', location.href).href;

  const rows = apps.map(a => {
    const cells = PERIOD_LIST.map(p => `<td style="text-align:right">${money(billed * a[p.key] * discountFactor(p.key, isFull))}</td>`).join('');
    return `<tr><td>${a.name}</td>${cells}</tr>`;
  }).join('');

  const totals = PERIOD_LIST.map(p => `<td style="text-align:right;font-weight:700">${money(priceFor(apps, u, p.key, isFull).price)}</td>`).join('');
  const pdRow = PERIOD_LIST.map(p => {
    const pd = periodDiscount(p.key);
    return `<td style="text-align:right;color:#1f9d68;font-size:11px">${pd > 0.005 ? '−' + pctTxt(pd) + ' vs mensual' : 'plan base'}</td>`;
  }).join('');

  const annual = priceFor(apps, u, 'annual', isFull);
  const discTxt = pctTxt(1 - annual.price / annual.list);

  // Datos del destinatario (ingresados en la UI)
  const val = id => (document.getElementById(id)?.value || '').trim();
  const company = val('rc-company');
  const attn = val('rc-attn');
  const quoteNo = val('rc-number');
  const city = val('rc-city') || 'Bogotá D.C.';

  const recipientBlock = (company || attn) ? `
      <div style="font-size:13px;margin-bottom:20px;line-height:1.6">
        <div>Señores:</div>
        ${company ? `<div style="font-weight:800;letter-spacing:.5px">${company}</div>` : ''}
        ${attn ? `<div>Atn.: ${attn}</div>` : ''}
      </div>
      <div style="font-size:15px;font-weight:700;color:#022457;letter-spacing:.5px;margin-bottom:20px">COTIZACIÓN OFICIAL – OTTO APIS</div>` : '';

  // Descripción de las aplicaciones a cotizar (según lo seleccionado)
  const appBullets = apps.map(a => `<li><b>${a.name}:</b> ${a.tag}.</li>`).join('');
  const appsBlock = `
      <div style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:700;color:#022457;margin-bottom:6px"></div>
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">Descripción del servicio:</div>
        <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#0b1d3a">Ponemos a su disposición las siguientes aplicaciones BIM para Autodesk Revit, orientadas a automatizar tareas repetitivas, reducir errores de coordinación y acelerar los flujos de trabajo de su equipo. El servicio se ofrece bajo modalidad de suscripción, ajustándose el precio según la cantidad de usuarios activos.</p>
        <ul style="margin:0 0 4px 18px;padding:0;font-size:12px;line-height:1.6;color:#0b1d3a">${appBullets}</ul>
      </div>`;

  return `
    <div style="font-family:Poppins,Arial,sans-serif;color:#0b1d3a;max-width:720px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #022457;padding-bottom:16px;margin-bottom:20px">
        <img src="${logo}" alt="OTTO" style="height:38px">
        <div style="text-align:right">
          <div style="font-size:12px;color:#5c6b82">${city} ${date}</div>
          ${quoteNo ? `<div style="font-size:12px;color:#5c6b82">Cotización No. ${quoteNo}</div>` : ''}
        </div>
      </div>

      ${recipientBlock}

      ${appsBlock}

      <div style="display:flex;gap:24px;font-size:13px;margin-bottom:18px">
        <div><b>Usuarios:</b> ${u}${u >= state.threshold ? ' (ilimitado)' : ''}</div>
        <div><b>Servicios:</b> ${apps.length} de ${APPS.length}</div>
        <div><b>Moneda:</b> ${CURRENCIES[state.currency].code}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#022457;color:#fff">
            <th style="text-align:left;padding:10px 12px">Servicio</th>
            ${PERIOD_LIST.map(p => `<th style="text-align:right;padding:10px 12px">${p.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background:#eef4ff"><td style="padding:10px 12px;font-weight:700">Total (${u} usuarios)</td>${totals}</tr>
          <tr><td style="padding:4px 12px"></td>${pdRow}</tr>
        </tbody>
      </table>

      <div style="margin-top:18px;background:#f2f6fb;border-radius:10px;padding:14px 16px;font-size:13px">
        <b>Recomendado — Plan Anual:</b> ${money(annual.price)}/año por ${apps.length} servicios,
        ${unlimited ? 'usuarios ilimitados' : `${u} usuarios`}.
        Ahorras <b style="color:#1f9d68">${money(annual.list - annual.price)}</b> (−${discTxt}) frente al precio de referencia.
      </div>
      ${hasBEP && unlimited ? `<div style="margin-top:12px;background:#e9f7f0;border:1px solid #bfe6d3;border-radius:10px;padding:12px 16px;font-size:13px;color:#1f9d68"><b>✓ Incluye Reporte en lote (BEP Revisor):</b> <span style="color:#0b1d3a">revisa varios modelos y genera un Excel a detalle.</span></div>` : ''}

      <div style="margin-top:12px;font-size:12px;color:#0b1d3a"><b>Nota:</b> Los precios no incluyen IVA hay que sumarlo al costo final de la actualización.</div>

      ${termsBlock()}

      <div style="margin-top:20px;font-size:13px;line-height:1.5">
        <div style="font-weight:700;color:#022457;margin-bottom:6px">ACEPTACIÓN</div>
        <p style="margin:0 0 8px">Agradecemos la confianza depositada en Otto Apis. Estamos a su disposición para resolver cualquier inquietud o modificar los términos según requiera su empresa.</p>
        <p style="margin:0 0 4px">Para mayor información o dudas adicionales, por favor contactar:</p>
        <div>Teléfono: [314 3839286 - 350 8376096]</div>
        <div>Correo: [appsotto00@gmail.com]</div>
      </div>

      <div style="margin-top:20px;font-size:13px;line-height:1.5">
        <p style="margin:0 0 22px">Atentamente,</p>
        <div style="font-weight:700;color:#022457">Ing. Christian Sarmiento</div>
        <div style="color:#5c6b82">Partner-Director</div>
      </div>

      <div style="margin-top:16px;font-size:11px;color:#9aa8bd;border-top:1px solid #e3e9f2;padding-top:10px">
        OTTO · Más de 10 años de experiencia BIM en Latinoamérica · Cotización generada el ${date}.
      </div>
    </div>`;
}

// Términos y condiciones (texto legal fijo de la cotización)
function termsBlock() {
  const h = t => `<div style="font-weight:700;color:#022457;font-size:13px;margin:12px 0 5px">${t}</div>`;
  const p = t => `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#0b1d3a">${t}</p>`;
  return `
    <div class="terms" style="margin-top:28px;border-top:1px solid #e3e9f2;padding-top:16px">
      <div style="font-weight:800;color:#022457;font-size:15px;letter-spacing:.5px;margin-bottom:8px">TÉRMINOS Y CONDICIONES</div>

      ${h('Licencias de escritorio:')}
      ${p('Consisten en aplicaciones descargables que el usuario instala directamente en su computador. Estas licencias se habilitan tras el registro del usuario, selección del producto, y pago en línea a través de la pasarela de pagos PayU. El usuario podrá acceder, desde su portal personal, a las versiones disponibles del software correspondientes a las últimas cinco versiones de Autodesk Revit en idioma inglés.')}

      ${h('Métodos y condiciones de pago:')}
      ${p('Los pagos se procesan exclusivamente mediante la pasarela de pagos PayU, que actúa como intermediario de pagos. El usuario deberá:')}
      <ul style="margin:0 0 8px 18px;padding:0;font-size:12px;line-height:1.6;color:#0b1d3a">
        <li>Registrarse en la plataforma de OTTO APIS.</li>
        <li>Seleccionar el producto o servicio deseado.</li>
        <li>Realizar el pago a través de PayU.</li>
      </ul>
      ${p('Esperar la confirmación automática de la activación de la licencia.')}
      ${p('La activación del servicio se realizará de forma inmediata, siempre que el pago haya sido aprobado satisfactoriamente.')}

      ${h('Impuestos y tributos:')}
      ${p('Los precios no incluyen el Impuesto al Valor Agregado (IVA) y demás tributos aplicables según la jurisdicción del usuario. En Colombia, el servicio está sujeto al régimen tributario vigente. Los usuarios internacionales serán responsables de pagar los impuestos locales en su país de residencia si aplica.')}

      ${p('<b>Nota:</b> Al momento de realizar la compra se aceptarán los siguientes documentos:')}
      <ul style="margin:0 0 8px 18px;padding:0;font-size:12px;line-height:1.6;color:#0b1d3a">
        <li>Autorización para tratamiento de datos.</li>
        <li>Política de Protección de Datos.</li>
        <li>Términos y Condiciones.</li>
      </ul>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => { bind(); render(); fetchTRM(); });
