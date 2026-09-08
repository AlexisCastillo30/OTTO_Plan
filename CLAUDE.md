# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Cotizador comercial interactivo de **OTTO** (licencias de apps BIM). Herramienta de venta
de una sola página, sin build ni dependencias: se abre `index.html` directamente en el
navegador. Objetivo: mostrarle a constructoras/empresas cuánto ahorran al pasar de
licencias "por puesto" al Plan Empresa ilimitado.

## Cómo correrlo

No hay build, servidor ni tests. Abre `index.html` en el navegador (doble clic).
Para desarrollo con recarga, cualquier servidor estático sirve, p. ej.:
`python -m http.server 8000` y visita `http://localhost:8000`.
La única dependencia externa es la fuente Poppins vía Google Fonts (requiere internet;
sin conexión cae al stack de sistema).

## Arquitectura (lo que hay que entender)

Cuatro capas separadas a propósito para que **cambiar precios o textos nunca toque la lógica**:

- **`assets/data.js`** — única fuente de verdad de negocio. `APPS` (catálogo con precio
  por puesto mensual/semestral/anual, `platform`, `license` y módulos con `addon`/`requires`),
  `PLATFORMS` (Revit / Civil 3D), `PERIODS` (con `factor` = pagos por año y `months` = meses
  que cubre un pago), `ENTERPRISE.threshold` (umbral de puestos), `CONFIG` (TRM de respaldo,
  `iva`, `vigenciaDias`, `cortesiaMeses`) y `PLANS` (copy de las tarjetas). Para actualizar
  precios/apps/umbral/IVA se edita SOLO este archivo.
- **`assets/terms.js`** — todos los TEXTOS del PDF: `COMPANY` (ciudad, contacto, datos
  bancarios, firma, pie), `COPY` (descripción, portal, cortesía, vigencia, forma de pago,
  notas) y `TERMS` (términos y condiciones). Se escribe en prosa, admite `**negritas**` y
  variables `{{cliente}}`, `{{plataformas}}`, `{{vigencia_fecha}}`, `{{trm}}`, etc.
  (la lista completa está comentada arriba del archivo). Una sección de `TERMS` puede
  llevar `only: 'usd' | 'cop'` para aparecer solo en esa moneda. Para cambiar redacción
  legal, cuenta bancaria o firma se edita SOLO este archivo.
- **`assets/app.js`** — estado + cálculo + render manual del DOM. No hay framework. Es una
  **herramienta unificada** (sin pestañas): `renderTable()` pinta la tabla de servicios con
  checkbox, agrupada por plataforma, mostrando el precio de REFERENCIA por usuario v/s el
  propuesto (apps × 3 periodos); `renderCards()` pinta 3 tarjetas con el precio CONFIGURADO
  (según `state.selected` y `state.users`, con descuento/ahorro, tope ilimitado desde
  `threshold`). `render()` repinta todo desde `state`. `priceFor()` es el núcleo de cálculo
  y `unitFor()` el de la cotización. La distinción clave de UX: tabla = referencia por
  usuario, tarjetas = total configurado.
- **`assets/styles.css`** — tema claro (fondo blanco, cards navy) con la paleta de marca
  OTTO en variables CSS (`:root`). El logo real vive en `assets/logo-header.webp`.
  Los estilos del PDF viven aparte, en `printStyles()` dentro de `app.js`.

## Modelo de precios (el corazón del producto)

Regla de negocio, implementada en `app.js` sobre `data.js`:

- **Precio lista** = `usuarios × listSeat` (suma de apps elegidas, sin descuento).
- **Descuento por volumen** = tramos de `VOLUME_TIERS` según nº de usuarios (hasta 29).
- **Descuento por paquete** = `BUNDLE_DISCOUNT` extra si están TODAS las apps.
- **Por Licencias (real)** = `lista × (1 − volumen) × (1 − paquete)` (los descuentos se
  combinan multiplicativamente en `combinedDiscount()`).
- **Empresa** = `threshold × listSeat × (1 − combinedDiscount(threshold))` → **ILIMITADO**.

Consecuencia intencional (elegida por el negocio): Empresa cuesta lo mismo que `threshold`
puestos al MEJOR descuento, así el **punto de equilibrio es exacto en `threshold`** (30):
por debajo conviene Por Licencias, en el umbral empatan y por encima Empresa siempre gana
(cada usuario nuevo entra gratis). Por eso `VOLUME_TIERS` NO debe tener un tramo ≥ threshold
(rompería la monotonía y el cruce único). El banner y `renderQuote()` comparan el ahorro
contra el **precio lista**; `drawChart()` dibuja lista (punteada), por-licencias (escalonada)
y Empresa (plana), y recalcula el cruce. Los porcentajes de descuento son parámetros de
negocio en `data.js` — ajustarlos mueve todo el modelo pero no requiere tocar la lógica.

## Convenciones

- Todo el texto de cara al usuario está en **español**; los precios se formatean con
  `money(n, moneda?)`, que respeta `state.currency` (`usd`/`cop`) salvo que se le pase una
  moneda explícita (así el PDF muestra la columna de equivalencia en COP). Formato tipo
  cotización: `US$ 1.260,00` y `$ 3.957.093`. Los datos base están en USD.
- **TRM en vivo**: `fetchTRM()` consulta la Tasa Representativa del Mercado desde Datos Abiertos
  Colombia (Socrata dataset `32sa-8pi3`, campo `valor`; CORS `*`, requiere internet) y
  sobreescribe `CURRENCIES.cop.rate`. Si falla, cae a `CONFIG.copRate` (respaldo editable en
  `data.js`) y `{{trm_fuente}}` lo dice en el PDF. El estado se muestra en `#trm-note`.
- **Exportar**: `exportQuote()` rellena `#print-doc` con `buildPrintDoc()` y llama
  `window.print()`. El CSS `@media print` oculta la app y muestra solo `#print-doc` (así el
  usuario guarda como PDF sin dependencias externas); los términos siempre arrancan en
  página nueva. El documento reproduce el formato de las cotizaciones oficiales OTTO APIS:
  encabezado con logo y consecutivo, destinatario, descripción, portal, alcance y cortesía
  opcionales, tabla con IVA, resumen, vigencia, datos de pago, términos y firma.
  `planTable()` cotiza UN plan (`state.plan`) con valor unitario mensual y del periodo
  (referencia tachada + % de descuento).
- **Moneda del PDF**: sale SIEMPRE del selector USD/COP del header. La columna extra
  "Total COP" es opt-in (`state.showCop`, casilla en la UI) y solo aplica cotizando en
  USD — es el formato con valor contractual en dólares y equivalencia informativa.
- **El logo hay que esperarlo**: `exportQuote()` no llama a `window.print()` hasta que
  las `<img>` del documento terminan de cargar (con tope de 3 s). Si se imprime de
  inmediato el PDF sale sin logo. Si la imagen falla, un `onerror` la reemplaza por el
  wordmark "OTTO" en texto.
- **Sin encabezado del navegador, con margen en TODAS las páginas**: `@page { margin: 0 }`
  deja la hoja sin espacio reservado, así Chrome no imprime su fecha/URL. Como el margen
  cero afecta a todas las páginas, el documento se envuelve en `<table class="sheet">`:
  `thead` y `tfoot` son los únicos elementos que el navegador REPITE en cada hoja, así
  que sus filas (`.m-top` / `.m-bot`) hacen de margen superior e inferior. Los laterales
  los pone el `padding` de `td.doc`. **No quitar esa tabla**: sin ella, la segunda página
  y las siguientes arrancan pegadas al borde.
- El descuento del PDF sale del modelo (periodo + volumen + paquete), no se teclea a mano:
  la referencia siempre es `mensual × meses`, así el `−45%` del plan anual y los tramos de
  volumen quedan explícitos para el cliente.
- El logo del header es `assets/logo-header.webp` (wordmark oscuro sobre transparente,
  pensado para el fondo blanco). Si cambia la marca, reemplaza solo ese archivo.
- `state.selected` nunca puede quedar vacío (siempre al menos una app), invariante que se
  fuerza en los handlers de `app.js`.
- Los **módulos** (`addon: true` + `requires`) no tienen precio, no se pueden activar sin su
  app base y se apagan solos cuando ésta se desactiva. Se cotizan como "Incluido" y su
  nombre se funde en el concepto de la app base ("BEP Revisor – Licencia anual con
  MultiReport"); si algún día se les pone precio, pasan a ser fila propia sin tocar código.
  **No entran por defecto**: `includedFrom: N` los activa solos al llegar a N licencias
  (MultiReport, desde 30) y los retira al bajar de ahí; entre medias se marcan a mano.
  Por eso el estado inicial de `state.selected` excluye los `addon`.
- El **descuento por paquete** se mide sobre las apps con precio (`allAppsSelected()`), no
  sobre el catálogo completo: un módulo gratis no debe decidir si aplica o no el bundle.
