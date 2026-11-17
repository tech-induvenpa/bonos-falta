// Adaptador de entrada: la página donde Marcos registra faltas.
// shortcut: abierta a quien tenga el enlace porque Marcos no tiene cuenta de Induvenpa; cerrarla cuando la tenga.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('adaptadores/pagina')
    .setTitle('Registrar una falta')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function datosDePagina() {
  // Columna C de Personas: el rol agrupa los nombres en la página; sin rol, van a «Otros».
  const filas = SpreadsheetApp.getActive().getSheetByName('Personas').getRange('A2:C').getValues();
  const rolDe = Object.fromEntries(filas.map(([nombre, , rol]) => [String(nombre).trim(), String(rol).trim() || 'Otros']));
  return {
    personas: leerNombres_().map((nombre) => ({ nombre, rol: rolDe[nombre] })),
    // Cada gravedad dice cuánto quita, tomado de la pestaña Pesos: el texto nunca queda viejo.
    gravedades: Object.entries(leerPesos_()).map(([gravedad, peso]) => ({ gravedad, texto: `${gravedad} · ${Math.round(peso * 1000) / 10} %` })),
    tipos: TIPOS,
    hoy: diaDeHoy_(0),
    ayer: diaDeHoy_(-1),
  };
}

// Responde { error } con el mensaje para Marcos; lo inesperado se registra y él ve un aviso genérico.
function guardarFalta(entrada) {
  try {
    const falta = registrarFalta(entrada, {
      personas: leerNombres_(), gravedades: Object.keys(leerPesos_()), hoy: diaDeHoy_(0), abiertoDesde: dia_(periodo_().desde),
    });
    agregarFalta_(falta);
    return { ok: true };
  } catch (e) {
    if (e instanceof FaltaInvalida) return { error: e.message };
    console.error(e);
    return { error: 'No se pudo guardar. Intenta de nuevo en un momento.' };
  }
}

function diaDeHoy_(desplazamiento) {
  return dia_(new Date(Date.now() + desplazamiento * 864e5)); // Caracas no cambia de hora en el año
}
