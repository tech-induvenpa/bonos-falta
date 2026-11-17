// Cálculo puro del bono: lo usa la hoja (Apps Script) y lo prueban los tests (node).
const TODOS = 'Todos';
const TIPOS = ['De conducta'];

// Fechas como 'AAAA-MM-DD' para comparar por día sin líos de zona horaria.
function calcularResumen(personas, pesos, faltas, desde, hasta) {
  const vigentes = faltas.filter((f) => {
    const dia = f.fecha || f.registro;
    return !f.anulada && dia >= desde && dia <= hasta;
  });
  vigentes.forEach((f) => {
    if (!(f.gravedad in pesos)) throw new Error(`La gravedad «${f.gravedad}» no está en la pestaña Pesos.`);
  });

  return personas.map(({ nombre, bono }) => {
    const suyas = vigentes.filter((f) => f.afecta.includes(TODOS) || f.afecta.includes(nombre));
    const descuento = Math.min(1, suyas.reduce((suma, f) => suma + pesos[f.gravedad], 0));
    return {
      nombre,
      bono,
      descuento,
      cobra: bono === null ? null : Math.round(bono * (1 - descuento) * 100) / 100, // sin monto todavía: solo el descuento
      faltas: suyas.map((f) => ({ fecha: f.fecha || f.registro, gravedad: f.gravedad, detalle: f.detalle })),
    };
  });
}

// Valida lo que llega de afuera (la página está abierta a quien tenga el enlace) y normaliza.
// El mensaje es para Marcos: la página lo muestra tal cual.
class FaltaInvalida extends Error {}

function registrarFalta(entrada, { personas, gravedades, hoy, abiertoDesde }) {
  if (!entrada.id) throw new FaltaInvalida('No se pudo preparar la falta: recarga la página.');
  if (!TIPOS.includes(entrada.tipo)) throw new FaltaInvalida('Elige el tipo de falta.');
  if (!gravedades.includes(entrada.gravedad)) throw new FaltaInvalida('Elige la gravedad.');
  const detalle = String(entrada.detalle || '').trim();
  if (!detalle) throw new FaltaInvalida('Escribe qué pasó.');
  if (detalle.length > 2000) throw new FaltaInvalida('El texto de qué pasó es muy largo: resúmelo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha || '')) throw new FaltaInvalida('Elige la fecha de la falta.');
  if (entrada.fecha > hoy) throw new FaltaInvalida('La fecha de la falta no puede ser futura.');
  if (entrada.fecha < abiertoDesde) throw new FaltaInvalida('Esa fecha es de un período que ya se pagó.');
  if (!Array.isArray(entrada.afecta) || !entrada.afecta.length) throw new FaltaInvalida('Elige a quién afecta.');
  const ajeno = entrada.afecta.find((p) => !personas.includes(p));
  if (ajeno) throw new FaltaInvalida(`«${ajeno}» no está en la lista de personas.`);
  // En el orden de la lista; «a todos» se guarda con nombres para no tocar a quien entre después.
  const afecta = personas.filter((p) => entrada.afecta.includes(p));
  return {
    id: entrada.id,
    tipo: entrada.tipo,
    gravedad: entrada.gravedad,
    afecta,
    aTodos: afecta.length === personas.length,
    detalle,
    fecha: entrada.fecha,
    segundos: Number.isFinite(entrada.segundos) && entrada.segundos >= 0 ? Math.round(entrada.segundos) : '',
  };
}

// Al cerrar un período: el nuevo empieza al día siguiente y corta el mismo día del mes siguiente
// (fin de mes si el corte era fin de mes, o si ese día no existe).
function siguientePeriodo(hasta) {
  const [a, m, d] = hasta.split('-').map(Number);
  const finDeMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes de 1 a 12
  const [a2, m2] = m === 12 ? [a + 1, 1] : [a, m + 1];
  const d2 = d === finDeMes(a, m) ? finDeMes(a2, m2) : Math.min(d, finDeMes(a2, m2));
  const dos = (n) => String(n).padStart(2, '0');
  return {
    desde: new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10),
    hasta: `${a2}-${dos(m2)}-${dos(d2)}`,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { calcularResumen, registrarFalta, siguientePeriodo, FaltaInvalida, TODOS, TIPOS };
}
