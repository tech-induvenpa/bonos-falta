// Adaptador de entrada: la página donde Marcos registra faltas.
// shortcut: abierta a quien tenga el enlace porque Marcos no tiene cuenta de Induvenpa; cerrarla cuando la tenga.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('adaptadores/pagina')
    .setTitle('Registrar una falta')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function datosDePagina() {
  return { personas: leerNombres(), gravedades: Object.keys(leerPesos()), tipos: TIPOS, hoy: diaDeHoy(0), ayer: diaDeHoy(-1) };
}

// Responde { error } con el mensaje para Marcos; lo inesperado se registra y él ve un aviso genérico.
function guardarFalta(entrada) {
  try {
    const falta = registrarFalta(entrada, {
      personas: leerNombres(), gravedades: Object.keys(leerPesos()), hoy: diaDeHoy(0), abiertoDesde: dia(periodo().desde),
    });
    agregarFalta(falta);
    return { ok: true };
  } catch (e) {
    if (e instanceof FaltaInvalida) return { error: e.message };
    console.error(e);
    return { error: 'No se pudo guardar. Intenta de nuevo en un momento.' };
  }
}

function diaDeHoy(desplazamiento) {
  return dia(new Date(Date.now() + desplazamiento * 864e5)); // Caracas no cambia de hora en el año
}
