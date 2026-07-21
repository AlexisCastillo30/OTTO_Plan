/* ============================================================================
   OTTO · Cotizador Empresarial — DATOS
   ----------------------------------------------------------------------------
   Toda la configuración de precios y reglas de negocio vive aquí.
   Edita SOLO este archivo para actualizar precios, apps o el umbral Empresa.
   Precios en USD, por PUESTO (licencia por usuario), por periodo.
   ============================================================================ */

// --- Catálogo de apps (precio por puesto según periodo de facturación) --------
const APPS = [
  { id: 'bep-revisor',    name: 'BEP Revisor',    tag: 'Verifica modelos BIM en Revit según el BEP',        monthly: 65, semiannual: 294, annual: 432 },
  { id: 'arch-finish',    name: 'Arch Finish',    tag: 'Acabados arquitectónicos automatizados',            monthly: 45, semiannual: 204, annual: 298 },
  { id: 'parameter-tool', name: 'Parameter Tool', tag: 'Gestión masiva de parámetros',                      monthly: 15, semiannual: 68,  annual: 100 },
  { id: 'xyz',            name: 'XYZ',            tag: 'Coordenadas y geolocalización de elementos',          monthly: 15, semiannual: 68,  annual: 100 },
  { id: 'voids',          name: 'Voids',          tag: 'Detección y gestión de vacíos',                     monthly: 39, semiannual: 176, annual: 258 },
  { id: 'bep-civil',      name: 'BEP Civil',      tag: 'Revisión BEP para modelos en Civil 3D',           monthly: 39, semiannual: 176, annual: 258 },
  { id: 'datasync',       name: 'DataSync',       tag: 'Gestión masiva de parámetros de los modelos Civil 3D',             monthly: 39, semiannual: 176, annual: 258 },
];

// --- Periodos de facturación --------------------------------------------------
// factor = cuántos pagos de ese periodo hay en un año (para anualizar y comparar).
const PERIODS = {
  monthly:    { key: 'monthly',    label: 'Mensual',   short: '/mes', factor: 12 },
  semiannual: { key: 'semiannual', label: 'Semestral', short: '/sem', factor: 2  },
  annual:     { key: 'annual',     label: 'Anual',     short: '/año', factor: 1  },
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
// Valores alineados a la tabla de Excel (anclada en 30 usuarios = precio lista).
const VOLUME_TIERS = [
  { min: 1,  label: '1 – 9 licencias',   discount: 0.00 },
  { min: 10, label: '10 – 19 licencias', discount: 0.10 },
  { min: 20, label: '20 – 29 licencias', discount: 0.15 },
];

// --- Descuento por PAQUETE COMPLETO ------------------------------------------
// Descuento adicional por llevar TODAS las apps (se combina con el de volumen).
// ⚠️ VALOR DE EJEMPLO — ajústalo.
const BUNDLE_DISCOUNT = 0.10;

// --- Configuración general ----------------------------------------------------
// Tasa de cambio para mostrar precios en pesos colombianos (COP).
// ⚠️ Ajústala a la tasa vigente.
const CONFIG = {
  copRate: 4000, // 1 USD = 4.000 COP (editable)
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
      'Las 7 apps incluidas',
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
