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

Tres capas separadas a propósito para que **cambiar precios nunca toque la lógica**:

- **`assets/data.js`** — única fuente de verdad de negocio. `APPS` (catálogo con precio
  por puesto mensual/semestral/anual), `PERIODS` (con `factor` = pagos por año, usado para
  anualizar y comparar periodos), `ENTERPRISE.threshold` (umbral de puestos) y `PLANS`
  (copy de las tarjetas). Para actualizar precios/apps/umbral se edita SOLO este archivo.
- **`assets/app.js`** — estado + cálculo + render manual del DOM. No hay framework. Es una
  **herramienta unificada** (sin pestañas): `renderTable()` pinta la tabla de servicios con
  checkbox mostrando el precio de REFERENCIA por usuario (apps × 3 periodos); `renderCards()`
  pinta 3 tarjetas con el precio CONFIGURADO (según `state.selected` y `state.users`, con
  descuento/ahorro, tope ilimitado desde `threshold`); `renderTiers()` la leyenda de
  descuentos. `render()` repinta todo desde `state`. `priceFor()` es el núcleo de cálculo.
  La distinción clave de UX: tabla = referencia por usuario, tarjetas = total configurado.
- **`assets/styles.css`** — tema claro (fondo blanco, cards navy) con la paleta de marca
  OTTO en variables CSS (`:root`). El logo real vive en `assets/logo-header.webp`.

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
  `money()` (Intl), que respeta `state.currency` (`usd`/`cop`). Los datos base están en USD.
- **TRM en vivo**: `fetchTRM()` consulta la Tasa Representativa del Mercado desde Datos Abiertos
  Colombia (Socrata dataset `32sa-8pi3`, campo `valor`; CORS `*`, requiere internet) y
  sobreescribe `CURRENCIES.cop.rate`. Si falla, cae a `CONFIG.copRate` (respaldo editable en
  `data.js`). El estado se muestra en `#trm-note`.
- **Exportar**: `exportQuote()` rellena `#print-doc` con `buildPrintDoc()` y llama
  `window.print()`. El CSS `@media print` oculta la app y muestra solo `#print-doc` (así el
  usuario guarda como PDF sin dependencias externas).
- El logo del header es `assets/logo-header.webp` (wordmark oscuro sobre transparente,
  pensado para el fondo blanco). Si cambia la marca, reemplaza solo ese archivo.
- `state.selected` nunca puede quedar vacío (siempre al menos una app), invariante que se
  fuerza en los handlers de `app.js`.
