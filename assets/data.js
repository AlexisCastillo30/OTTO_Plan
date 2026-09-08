/* ============================================================================
   OTTO · Cotizador Empresarial — DATOS
   ----------------------------------------------------------------------------
   Toda la configuración de precios y reglas de negocio vive aquí.
   Edita SOLO este archivo para actualizar precios, apps o el umbral Empresa.
   Los TEXTOS de la cotización (términos y condiciones, datos bancarios, firma)
   viven en `assets/terms.js`.

   Precios en USD, por PUESTO (licencia por usuario), por periodo.
   Fuente: hoja de precios OTTO (columnas mes / semestre / año).
     · `monthly`    = valor de 1 mes.
     · `semiannual` = valor de 6 meses pagados por anticipado (≈ −25% vs mensual).
     · `annual`     = valor de 12 meses pagados por anticipado (≈ −45% vs mensual).
   ============================================================================ */

// --- Plataformas (agrupan el catálogo y redactan la cotización) ---------------
const PLATFORMS = {
  revit: { key: 'revit', label: 'Revit',    fullName: 'Autodesk Revit'    },
  civil: { key: 'civil', label: 'Civil 3D', fullName: 'Autodesk Civil 3D' },
};

// --- Catálogo de apps (precio por puesto según periodo de facturación) --------
// `license` = nombre técnico de la licencia. `id` = slug usado en la web.
// `addon: true` → módulo que se activa sobre otra app (`requires`). No tiene
// precio: se cotiza como "Incluido" y su nombre se funde en el concepto de la
// app base. `includedFrom: N` = se activa solo a partir de N licencias; por
// debajo de ese número NO va en la cotización salvo que se marque a mano.
const APPS = [
  // ---- Autodesk Revit -------------------------------------------------------
  { id: 'revisor-bim',            platform: 'revit', license: 'BEPRevisor',            name: 'BEP Revisor',             tag: 'Verifica modelos BIM en Revit según el BEP',                                monthly: 65, semiannual: 294, annual: 432 },
  { id: 'multireport',            platform: 'revit', license: 'Otto010',               name: 'BEP Revisor MultiReport', tag: 'Consulta y reporta todos los modelos de un proyecto sin abrirlos uno a uno', monthly: 0,  semiannual: 0,   annual: 0,   addon: true, requires: 'revisor-bim', includedFrom: 30 },
  { id: 'firestop-voids',         platform: 'revit', license: 'FirestopVoids',         name: 'Firestop Voids',          tag: 'Detección y gestión de vacíos y sellos cortafuego',                          monthly: 39, semiannual: 176, annual: 258 },
  { id: 'architectural-finishes', platform: 'revit', license: 'ArchitecturalFinishes', name: 'Architectural Finishes',  tag: 'Acabados arquitectónicos automatizados',                                     monthly: 45, semiannual: 204, annual: 298 },
  { id: 'parameter-tool',         platform: 'revit', license: 'ParameterTool',         name: 'Parameter Tool',          tag: 'Gestión masiva de parámetros',                                              monthly: 15, semiannual: 68,  annual: 100 },
  { id: 'xyzcoordinates',         platform: 'revit', license: 'XYZCoordinates',        name: 'XYZCoordinates',          tag: 'Coordenadas y geolocalización de elementos',                                 monthly: 15, semiannual: 68,  annual: 100 },
  { id: 'federated-views',        platform: 'revit', license: 'Otto011',               name: 'Federated Views',         tag: 'Vistas federadas de modelos vinculados',                                     monthly: 15, semiannual: 68,  annual: 100 },
  { id: 'sheet-manager',          platform: 'revit', license: 'Otto012',               name: 'Sheet Manager',           tag: 'Gestión y publicación masiva de planos',                                     monthly: 35, semiannual: 158, annual: 233 },
  { id: 'db-manager',             platform: 'revit', license: 'Otto013',               name: 'DBManager',               tag: 'Conecta el modelo con bases de datos externas',                              monthly: 35, semiannual: 158, annual: 233 },

  // ---- Autodesk Civil 3D ----------------------------------------------------
  { id: 'bep-revisor-civil',      platform: 'civil', license: 'BEPRevisorCivil',       name: 'BEPRevisor Civil',         tag: 'Revisión BEP para modelos en Civil 3D',                                     monthly: 45, semiannual: 204, annual: 298 },
  { id: 'psets-sync-civil',       platform: 'civil', license: 'PropertySetsSyncCivil', name: 'Property Sets Sync Civil', tag: 'Sincroniza property sets entre modelos Civil 3D',                           monthly: 39, semiannual: 176, annual: 258 },
  { id: 'data-base-civil',        platform: 'civil', license: 'DataBaseCivil',         name: 'DataBase Civil',           tag: 'Gestión masiva de datos de los modelos Civil 3D',                           monthly: 39, semiannual: 176, annual: 258 },
];

// --- Periodos de facturación --------------------------------------------------
// factor = cuántos pagos de ese periodo hay en un año (para anualizar y comparar).
// months = meses que cubre un pago (para calcular el precio lista de referencia).
// adj / adjPl / per = redacción del documento ("licencia anual", "licencias
// anuales", "US$ 1.499,40 / año").
const PERIODS = {
  monthly:    { key: 'monthly',    label: 'Mensual',   adj: 'mensual',   adjPl: 'mensuales',   per: 'mes',      short: '/mes', factor: 12, months: 1  },
  semiannual: { key: 'semiannual', label: 'Semestral', adj: 'semestral', adjPl: 'semestrales', per: 'semestre', short: '/sem', factor: 2,  months: 6  },
  annual:     { key: 'annual',     label: 'Anual',     adj: 'anual',     adjPl: 'anuales',     per: 'año',      short: '/año', factor: 1,  months: 12 },
};

// --- Regla de negocio Empresa -------------------------------------------------
// A partir de `threshold` puestos, el plan Empresa da licencias ILIMITADAS.
// Precio Empresa = threshold × (precio por puesto de las apps elegidas).
// => "Pagas 30, tienes infinitos". Punto de equilibrio exacto en `threshold`.
const ENTERPRISE = {
  threshold: 30,
};

// --- Descuentos por VOLUMEN (según nº de licencias) ---------------------------
// El precio por licencia baja a medida que se compran más puestos (hasta 29).
// A partir de `ENTERPRISE.threshold` (30) entra el Plan Empresa ilimitado.
// Se aplica el descuento del último tramo cuyo `min` se alcanza.
const VOLUME_TIERS = [
  { min: 1,  label: '1 – 9 licencias',   discount: 0.00 },
  { min: 10, label: '10 – 19 licencias', discount: 0.10 },
  { min: 20, label: '20 – 29 licencias', discount: 0.15 },
];

// --- Descuento por PAQUETE COMPLETO ------------------------------------------
// Descuento adicional por llevar TODAS las apps (se combina con el de volumen).
const BUNDLE_DISCOUNT = 0.10;

// --- Configuración general ----------------------------------------------------
const CONFIG = {
  copRate: 4000,      // respaldo si la TRM en vivo no responde (1 USD = X COP)
  iva: 0.19,          // IVA colombiano aplicado en la cotización
  vigenciaDias: 90,   // días calendario de validez de la oferta
  cortesiaMeses: 2,   // meses de cortesía del portafolio completo (si se activa)
};

// --- Planes destacados (tarjetas de marketing) --------------------------------
const PLANS = [
  {
    id: 'basico',
    name: 'Plan Básico',
    subtitle: 'Para empezar, por puesto',
    highlight: false,
    bullets: [
      'Elige 1 app a la vez',
      'Licencia por usuario',
      'Facturación mensual, semestral o anual',
      'Soporte por WhatsApp y correo',
    ],
    cta: 'Cotizar',
  },
  {
    id: 'empresa',
    name: 'Plan Empresa',
    subtitle: 'Usuarios ILIMITADOS',
    highlight: true,
    bullets: [
      'Todo el portafolio incluido',
      'Licencias ilimitadas (todo tu equipo)',
      'Precio fijo desde 30 puestos',
      'Onboarding y soporte prioritario',
    ],
    cta: 'Ver ahorro',
  },
  {
    id: 'customizado',
    name: 'Plan Customizado',
    subtitle: 'Arma tu paquete',
    highlight: false,
    bullets: [
      'Eliges qué apps quieres',
      'Eliges cuántos puestos',
      'Modo por puesto o Empresa ilimitado',
      'Ideal para constructoras y grupos',
    ],
    cta: 'Personalizar',
  },
];
