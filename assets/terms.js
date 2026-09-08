/* ============================================================================
   OTTO · Cotizador Empresarial — TEXTOS DE LA COTIZACIÓN
   ----------------------------------------------------------------------------
   ESTE ES EL ARCHIVO QUE SE EDITA PARA CAMBIAR EL TEXTO DEL PDF.
   No hay que tocar `app.js` ni `data.js` para cambiar redacción, términos,
   datos bancarios, contacto o firma. Guarda y recarga el navegador.

   ── Cómo escribir ───────────────────────────────────────────────────────────
   · Texto normal entre comillas. Usa **doble asterisco** para poner en negrita.
   · Variables entre llaves dobles; se reemplazan solas al exportar:

       {{cliente}}            Empresa destinataria (o "el cliente" si va vacío)
       {{atencion}}           Persona a quien va dirigida
       {{plataformas}}        "Autodesk Revit" / "Autodesk Revit y Autodesk Civil 3D"
       {{portafolio}}         "ocho (8) aplicaciones para Autodesk Revit y tres (3)…"
       {{plan}}               "Anual" · {{plan_adj}} → "anual"
       {{usuarios}}           Número de usuarios cotizados
       {{licencias}}          Licencias facturadas (topa en el umbral ilimitado)
       {{moneda}}             "USD" o "COP"
       {{moneda_texto}}       "en dólares" o "en pesos colombianos"
       {{iva}}                "19%"
       {{fecha}}              Fecha de la cotización
       {{vigencia_dias}}      Días de validez (CONFIG.vigenciaDias en data.js)
       {{vigencia_fecha}}     Fecha en que vence la oferta
       {{trm}}                TRM usada, ej. "$3.140,55 COP por US$1"
       {{trm_fecha}}          Fecha de la TRM
       {{trm_fuente}}         Origen de la TRM (Banco de la República o respaldo)
       {{cortesia_meses}}     Meses de cortesía, ej. "2"
       {{cortesia_meses_txt}} Meses en letra, ej. "dos (2)"
       {{titular}} {{banco}} {{tipo_cuenta}} {{cuenta}} {{correo}} {{telefono}}

   · En TERMS puedes marcar una sección con `only: 'usd'` o `only: 'cop'`
     para que aparezca solo cuando se cotiza en esa moneda.
     Sin `only`, la sección sale siempre.
   ============================================================================ */

// --- Datos de la empresa (encabezado, pago, contacto y firma) -----------------
const COMPANY = {
  razonSocial: 'OTTO APIS S.A.S.',
  ciudad:      'Bogotá D.C.',
  telefono:    '314 383 9286 – 350 837 6096',
  correo:      'contacto@ottoapis.com',

  banco: {
    titular:     'OTTO APIS S.A.S.',
    banco:       'AV Villas',
    tipoCuenta:  'Corriente',
    numeroCuenta:'066070095',
  },

  firma: {
    nombre: 'Ing. Christian Sarmiento',
    cargo:  'Socio Cofundador',
  },

  pie: 'OTTO · Más de 10 años de experiencia BIM en Latinoamérica · Cotización generada el {{fecha}}.',
};

// --- Cuerpo de la cotización (página 1) --------------------------------------
// Cada bloque tiene un título y uno o varios párrafos. Deja `''` para omitir.
const COPY = {
  tituloDocumento: 'COTIZACIÓN OFICIAL – OTTO APIS',

  descripcion: {
    titulo: 'Descripción del servicio:',
    texto:  'Ponemos a su disposición las siguientes aplicaciones BIM para {{plataformas}}, orientadas a automatizar tareas repetitivas, reducir errores de coordinación y acelerar los flujos de trabajo de su equipo. El servicio se ofrece bajo modalidad de suscripción {{plan_adj}}, según la cantidad de usuarios activos.',
  },

  portal: {
    titulo: 'Portal de gestión de licencias y usuarios:',
    texto:  'La suscripción incluye, sin costo adicional, el acceso al portal de gestión de OTTO APIS. Desde allí el administrador designado por {{cliente}} podrá asignar y reasignar licencias, activar y desactivar cuentas, consultar el estado y la fecha de vencimiento de cada licencia y descargar las versiones del software correspondientes a las últimas cinco versiones de {{plataformas}}.',
    // Nombre con el que aparece la fila del portal dentro de la tabla de precios.
    filaConcepto: 'Portal de gestión de licencias y usuarios',
  },

  // Solo aparece si escribes algo en el campo "Alcance de esta propuesta" de la web.
  alcance: {
    titulo: 'Alcance de esta propuesta:',
  },

  // Solo aparece si activas la casilla "Cortesía" en la web.
  cortesia: {
    titulo: 'Cortesía comercial — acceso al portafolio completo:',
    texto:  'Adicionalmente y sin costo alguno, OTTO APIS otorga a {{cliente}} acceso durante {{cortesia_meses_txt}} meses calendario a la totalidad de su portafolio: {{portafolio}}. El acceso se habilita para los mismos {{usuarios}} usuarios, se activa junto con las licencias cotizadas y se gestiona desde el mismo portal. Al finalizar los {{cortesia_meses}} meses las aplicaciones adicionales se desactivan automáticamente, sin cobro ni renovación.',
    filaConcepto: 'Cortesía — {{cortesia_meses}} meses de acceso al portafolio completo',
    filaDetalle:  '{{portafolio}}.',
  },

  // Nota que va debajo de la tabla cuando se cotiza en USD.
  notaTRM: 'Equivalencia en pesos calculada con la TRM de {{trm}}, {{trm_fuente}}. El valor en dólares es el valor contractual de la oferta; el pago en pesos se liquidará con la TRM vigente en la fecha de la transferencia.',

  vigencia: {
    titulo: 'Vigencia de la oferta:',
    texto:  'Los valores aquí cotizados se mantendrán vigentes por un periodo de **{{vigencia_dias}} días calendario** contados a partir de la fecha de expedición de esta cotización, es decir hasta el **{{vigencia_fecha}}**. Dentro de ese periodo {{cliente}} podrá formalizar la compra conservando el valor unitario {{moneda_texto}} aquí indicado.',
  },

  formaPago: {
    titulo: 'Forma de pago:',
    texto:  'El valor de esta cotización se paga mediante consignación o transferencia electrónica a la cuenta corriente de {{titular}} relacionada a continuación. Se adjunta el certificado bancario de la cuenta.',
    cierre: 'Una vez realizado el pago, el cliente deberá enviar el soporte o certificación del pago al correo **{{correo}}**. Con la verificación de dicho soporte se generarán y habilitarán las licencias correspondientes.',
  },

  notaIVA: '**Nota:** Los valores de la tabla incluyen el IVA del {{iva}} en la fila "Total a pagar". El subtotal corresponde al valor del servicio antes de impuestos.',

  aceptacion: {
    titulo: 'ACEPTACIÓN',
    texto:  'Agradecemos la confianza depositada en OTTO APIS. Estamos a su disposición para resolver cualquier inquietud o modificar los términos según requiera su empresa.',
    contacto: 'Para mayor información o dudas adicionales, por favor contactar:',
  },
};

// --- Términos y condiciones (página 2) ---------------------------------------
// Cada sección: { titulo, body: [ 'párrafo', { list: ['ítem', 'ítem'] } ] }
// Opcional: only: 'usd' | 'cop'  → limita la sección a esa moneda.
const TERMS = {
  titulo: 'TÉRMINOS Y CONDICIONES',
  secciones: [
    {
      titulo: 'Licencias de escritorio:',
      body: [
        'Consisten en aplicaciones descargables que el usuario instala directamente en su computador. Estas licencias se habilitan tras el registro del usuario, la selección del producto y la verificación del pago realizado a la cuenta bancaria de {{titular}}. El usuario podrá acceder, desde su portal personal, a las versiones disponibles del software correspondientes a las últimas cinco versiones de {{plataformas}} en idioma inglés.',
      ],
    },
    {
      titulo: 'Vigencia de la oferta y condiciones de moneda:',
      only: 'usd',
      body: [
        'Los valores unitarios en dólares se mantienen fijos durante {{vigencia_dias}} días calendario a partir de la fecha de esta cotización. La equivalencia en pesos colombianos es informativa y se calculó con la TRM del {{trm_fecha}} ({{trm}}); el valor definitivo en pesos se liquidará con la TRM vigente en la fecha en que se realice el pago. La vigencia de la licencia es de doce (12) meses contados a partir de la activación.',
      ],
    },
    {
      titulo: 'Vigencia de la oferta:',
      only: 'cop',
      body: [
        'Los valores aquí cotizados se mantienen fijos durante {{vigencia_dias}} días calendario a partir de la fecha de esta cotización, es decir hasta el {{vigencia_fecha}}. La vigencia de la licencia corresponde al periodo contratado ({{plan_adj}}) contado a partir de la activación.',
      ],
    },
    {
      titulo: 'Portal de gestión de licencias y usuarios:',
      body: [
        'El acceso al portal se otorga durante toda la vigencia de la suscripción y no tiene costo adicional. Las licencias son nominativas y pueden ser reasignadas entre usuarios de {{cliente}} desde el portal; el número de usuarios activos simultáneos no podrá exceder la cantidad contratada en esta cotización.',
      ],
    },
    {
      titulo: 'Métodos y condiciones de pago:',
      body: [
        'Los pagos correspondientes a esta cotización se realizan por consignación o transferencia bancaria a la cuenta corriente de {{titular}} en el Banco {{banco}} No. {{cuenta}}. El usuario deberá:',
        { list: [
          'Registrarse en la plataforma de OTTO APIS.',
          'Seleccionar el producto o servicio deseado.',
          'Realizar la consignación o transferencia por el valor total, IVA incluido.',
          'Enviar el soporte o certificación del pago al correo {{correo}}.',
          'Esperar la confirmación de la activación de la licencia.',
        ]},
        'La activación del servicio se realizará una vez {{titular}} verifique la certificación del pago recibida.',
      ],
    },
    {
      titulo: 'Impuestos y tributos:',
      body: [
        'Los valores del servicio están sujetos al Impuesto al Valor Agregado (IVA) del {{iva}} y demás tributos aplicables según la jurisdicción del usuario. En Colombia, el servicio está sujeto al régimen tributario vigente. Los usuarios internacionales serán responsables de pagar los impuestos locales en su país de residencia si aplica.',
      ],
    },
    {
      titulo: '',
      body: [
        '**Nota:** Al momento de realizar la compra se aceptarán los siguientes documentos:',
        { list: [
          'Autorización para tratamiento de datos.',
          'Política de Protección de Datos.',
          'Términos y Condiciones.',
        ]},
      ],
    },
  ],
};
