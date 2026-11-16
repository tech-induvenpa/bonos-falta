// Adaptador de la hoja de cálculo: es el almacén de Personas, Pesos y Faltas, y escribe el estado del bono.
const ESTADO = 'Estado del bono';
const PREGUNTA = {
  tipo: 'Tipo de falta',
  gravedad: 'Gravedad',
  afecta: '¿A quién afecta?',
  detalle: '¿Qué pasó?',
  fecha: 'Fecha de la falta',
};
const ANULADA = 'Anulada (escribe el motivo)';
const ID = 'Id';
const A_TODOS = '¿A todos?';
const SEGUNDOS = 'Segundos para registrar';
const GRAVEDADES = ['Leve', 'Media', 'Grave', 'Crítica'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bono')
    .addItem('Actualizar estado del bono', 'actualizarEstado')
    .addItem('Cerrar período (día de pago)', 'cerrarPeriodo')
    .addToUi();
}

// Se corrió una sola vez (16-nov-2026) para armar la hoja. El formulario de Google que crea
// fue la primera entrada de faltas; la página (web.js) lo reemplazó.
function crear() {
  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty('formId')) throw new Error('El formulario ya existe: no lo creo dos veces.');
  const libro = SpreadsheetApp.getActive();
  libro.setSpreadsheetTimeZone('America/Caracas');

  const personas = libro.getSheets()[0].setName('Personas');
  personas.getRange('A1:B1').setValues([['Nombre', 'Bono ($)']]).setFontWeight('bold');
  personas.setFrozenRows(1);

  const pesos = libro.insertSheet('Pesos');
  pesos.getRange('A1:B5').setValues([['Gravedad', 'Descuento'], ['Leve', 0.05], ['Media', 0.15], ['Grave', '=1/3'], ['Crítica', 1]]);
  pesos.getRange('A1:B1').setFontWeight('bold');
  pesos.getRange('B2:B5').setNumberFormat('0.00%');

  const hoy = new Date();
  const resumen = libro.insertSheet(ESTADO);
  resumen.getRange('A1:B2').setValues([
    ['Desde', new Date(hoy.getFullYear(), hoy.getMonth(), 1)],
    ['Hasta', new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)],
  ]);
  resumen.getRange('B1:B2').setNumberFormat('dd/MM/yyyy');
  resumen.getRange('A1:A2').setFontWeight('bold');

  const form = FormApp.create('Registrar una falta');
  form.setDescription('Bono por desempeño de Induvenpa. Una falta por envío.');
  form.setConfirmationMessage('Falta registrada.');
  try { form.setRequireLogin(false); } catch (e) { /* cuentas sin Workspace no restringen por dominio */ }
  form.addMultipleChoiceItem().setTitle(PREGUNTA.tipo).setChoiceValues(TIPOS).setRequired(true);
  form.addMultipleChoiceItem().setTitle(PREGUNTA.gravedad).setChoiceValues(GRAVEDADES)
    .setHelpText('Crítica: pierde el bono completo del mes.').setRequired(true);
  form.addCheckboxItem().setTitle(PREGUNTA.afecta).setChoiceValues([TODOS]).setRequired(true);
  form.addParagraphTextItem().setTitle(PREGUNTA.detalle).setRequired(true);
  form.addDateItem().setTitle(PREGUNTA.fecha).setHelpText('Déjala vacía si fue hoy.').setRequired(false);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, libro.getId());
  SpreadsheetApp.flush();

  const faltas = libro.getSheets().find((h) => h.getFormUrl());
  faltas.setName('Faltas');
  faltas.getRange(1, faltas.getLastColumn() + 1).setValue(ANULADA);
  props.setProperty('formId', form.getId());

  ScriptApp.newTrigger('alEditar').forSpreadsheet(libro).onEdit().create();
  Logger.log('Enlace para Marcos: ' + form.shortenFormUrl(form.getPublishedUrl()));
}

// Activador de edición creado por crear(). Las escrituras del script no lo disparan: no hay bucle.
function alEditar(e) {
  const hoja = e.range.getSheet().getName();
  if (['Personas', 'Pesos', 'Faltas', ESTADO].includes(hoja)) actualizarEstado();
  // shortcut: sigue sincronizando el formulario viejo; quitarlo cuando se cierre ese formulario.
  if (hoja === 'Personas') actualizarPersonas();
}

// El estado del bono se recalcula solo; si algo de la hoja lo impide, lo dice en A3 en vez de fallar.
function actualizarEstado() {
  const aviso = hojaEstado().getRange('A3');
  try {
    armarResumen();
    aviso.clearContent();
  } catch (e) {
    aviso.setValue('No se pudo calcular: ' + e.message).setFontColor('#b3261e');
  }
}

function actualizarPersonas() {
  const form = FormApp.openById(PropertiesService.getDocumentProperties().getProperty('formId'));
  const casillas = form.getItems(FormApp.ItemType.CHECKBOX).find((i) => i.getTitle() === PREGUNTA.afecta);
  casillas.asCheckboxItem().setChoiceValues([TODOS, ...leerNombres()]);
}

// Guarda una falta ya validada por el dominio. Si el mismo envío llega dos veces
// (Marcos reintenta tras un corte de red), la segunda no se guarda.
function agregarFalta(falta) {
  const libro = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // revisar el Id y agregar la fila tienen que ser un solo paso
  try {
    const hoja = libro.getSheetByName('Faltas');
    const titulos = asegurarColumnas(hoja, [ID, A_TODOS, SEGUNDOS]);
    const filas = hoja.getLastRow() - 1;
    const ids = filas > 0 ? hoja.getRange(2, titulos.indexOf(ID) + 1, filas).getValues().flat() : [];
    if (ids.includes(falta.id)) return;
    const valor = {
      [PREGUNTA.tipo]: falta.tipo,
      [PREGUNTA.gravedad]: falta.gravedad,
      [PREGUNTA.afecta]: falta.afecta.join(', '),
      [PREGUNTA.detalle]: comoTexto(falta.detalle),
      [PREGUNTA.fecha]: Utilities.parseDate(falta.fecha, libro.getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
      [ID]: falta.id,
      [A_TODOS]: falta.aTodos ? 'Sí' : 'No',
      [SEGUNDOS]: falta.segundos,
    };
    // La primera columna es la marca temporal, como en las filas del formulario.
    hoja.appendRow(titulos.map((t, i) => (i === 0 ? new Date() : t in valor ? valor[t] : '')));
    actualizarEstado(); // dentro del bloqueo: dos envíos seguidos no dejan un estado viejo
  } finally {
    lock.releaseLock();
  }
}

function asegurarColumnas(hoja, nombres) {
  const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  nombres.filter((n) => !titulos.includes(n)).forEach((n) => {
    titulos.push(n);
    hoja.getRange(1, titulos.length).setValue(n);
  });
  return titulos;
}

// La página es pública: un texto que empieza con = + - @ se volvería fórmula en la hoja.
function comoTexto(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// El día de pago: guarda una copia congelada de lo que se paga y abre el período siguiente.
function cerrarPeriodo() {
  const ui = SpreadsheetApp.getUi();
  const { desde, hasta } = periodo();
  const fecha = (d) => dia(d).split('-').reverse().join('/');
  const ok = ui.alert('Cerrar período',
    `Se paga lo que muestra «${ESTADO}» del ${fecha(desde)} al ${fecha(hasta)}. ` +
    'Después no se podrán registrar faltas de esas fechas. ¿Cerrar?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;

  const libro = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // que ninguna falta entre a medio cierre
  try {
    const nombre = `Pagado ${fecha(desde)} a ${fecha(hasta)}`.replace(/\//g, '-');
    if (libro.getSheetByName(nombre)) throw new Error('Ese período ya se cerró.');
    armarResumen(); // si algo impide calcular, no se cierra
    hojaEstado().copyTo(libro).setName(nombre).protect().setWarningOnly(true);
    const siguiente = siguientePeriodo(dia(hasta));
    const tz = libro.getSpreadsheetTimeZone();
    hojaEstado().getRange('B1:B2').setValues([
      [Utilities.parseDate(siguiente.desde, tz, 'yyyy-MM-dd')],
      [Utilities.parseDate(siguiente.hasta, tz, 'yyyy-MM-dd')],
    ]);
    actualizarEstado();
  } finally {
    lock.releaseLock();
  }
}

// La pestaña se llamó «Resumen» hasta el 16-nov-2026; la primera vez que se usa, se renombra.
function hojaEstado() {
  const libro = SpreadsheetApp.getActive();
  return libro.getSheetByName(ESTADO) || libro.getSheetByName('Resumen').setName(ESTADO);
}

function periodo() {
  const [[desde], [hasta]] = hojaEstado().getRange('B1:B2').getValues();
  if (!(desde instanceof Date) || !(hasta instanceof Date)) throw new Error('Escribe una fecha en Desde y en Hasta.');
  return { desde, hasta };
}

function dia(fecha) {
  return Utilities.formatDate(fecha, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function armarResumen() {
  const { desde, hasta } = periodo();
  const resumen = hojaEstado();
  const filas = calcularResumen(leerPersonas(), leerPesos(), leerFaltas(dia), dia(desde), dia(hasta));
  resumen.getRange('A4:E').clearContent();
  resumen.getRange('A4:E4').setValues([['Nombre', 'Bono ($)', 'Descuento', 'Cobra ($)', 'Faltas']]).setFontWeight('bold');
  if (!filas.length) return;
  const legible = (f) => `${f.fecha.split('-').reverse().join('/')} · ${f.gravedad} · ${f.detalle}`;
  resumen.getRange(5, 1, filas.length, 5).setValues(
    filas.map((f) => [f.nombre, f.bono, f.descuento, f.cobra, f.faltas.map(legible).join('\n')]));
  resumen.getRange(5, 3, filas.length, 1).setNumberFormat('0.00%');
}

// Solo nombres: el bono se valida al armar el resumen, no mientras se escribe la lista.
function leerNombres() {
  const nombres = SpreadsheetApp.getActive().getSheetByName('Personas').getRange('A2:A').getValues()
    .map(([n]) => String(n).trim()).filter(Boolean);
  // La hoja guarda a quién afecta separado por comas: un nombre con coma no se podría leer.
  const conComa = nombres.find((n) => n.includes(','));
  if (conComa) throw new Error(`El nombre «${conComa}» tiene una coma: quítala en la pestaña Personas.`);
  return nombres;
}

function leerPersonas() {
  const filas = SpreadsheetApp.getActive().getSheetByName('Personas').getDataRange().getValues().slice(1);
  return filas.filter(([nombre]) => String(nombre).trim()).map(([nombre, bono]) => {
    if (typeof bono !== 'number') throw new Error(`Falta el bono de «${nombre}» en la pestaña Personas.`);
    return { nombre: String(nombre).trim(), bono };
  });
}

function leerPesos() {
  const filas = SpreadsheetApp.getActive().getSheetByName('Pesos').getDataRange().getValues().slice(1);
  return Object.fromEntries(filas.filter(([g]) => g).map(([g, peso]) => [g, peso]));
}

function leerFaltas(dia) {
  const [titulos, ...filas] = SpreadsheetApp.getActive().getSheetByName('Faltas').getDataRange().getValues();
  const col = (titulo) => {
    const i = titulos.indexOf(titulo);
    if (i < 0) throw new Error(`No encuentro la columna «${titulo}» en la pestaña Faltas.`);
    return i;
  };
  const c = { gravedad: col(PREGUNTA.gravedad), afecta: col(PREGUNTA.afecta), detalle: col(PREGUNTA.detalle), fecha: col(PREGUNTA.fecha), anulada: col(ANULADA) };
  return filas.filter((f) => f[0] instanceof Date).map((f) => ({
    registro: dia(f[0]), // la primera columna siempre es la marca temporal
    fecha: f[c.fecha] instanceof Date ? dia(f[c.fecha]) : '',
    gravedad: f[c.gravedad],
    afecta: String(f[c.afecta]).split(', ').filter(Boolean),
    detalle: f[c.detalle],
    anulada: String(f[c.anulada]).trim(),
  }));
}
