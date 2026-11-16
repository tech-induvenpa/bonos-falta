const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularResumen, TODOS } = require('./bono.js');

const PESOS = { Leve: 0.05, Media: 0.15, Grave: 1 / 3, 'Crítica': 1 };
const PERSONAS = [{ nombre: 'Pedro', bono: 100 }, { nombre: 'Luis', bono: 100 }];
const DESDE = '2026-11-01';
const HASTA = '2026-11-30';

const falta = (afecta, gravedad, extra = {}) => ({
  fecha: '2026-11-20', registro: '2026-11-20', gravedad, afecta, detalle: 'algo', anulada: '', ...extra,
});
const de = (filas, nombre) => filas.find((f) => f.nombre === nombre);
const resumen = (faltas) => calcularResumen(PERSONAS, PESOS, faltas, DESDE, HASTA);

test('sin faltas cobra el bono completo', () => {
  const pedro = de(resumen([]), 'Pedro');
  assert.equal(pedro.cobra, 100);
  assert.equal(pedro.descuento, 0);
  assert.deepEqual(pedro.faltas, []);
});

test('los descuentos se suman sobre el bono completo', () => {
  const pedro = de(resumen([falta(['Pedro'], 'Leve'), falta(['Pedro'], 'Media')]), 'Pedro');
  assert.equal(pedro.cobra, 80);
});

test('tres graves dejan el bono exactamente en cero', () => {
  const tres = [1, 2, 3].map(() => falta(['Pedro'], 'Grave'));
  assert.equal(de(resumen(tres), 'Pedro').cobra, 0);
});

test('nunca baja de cero, pero las faltas se siguen listando', () => {
  const pedro = de(resumen([falta(['Pedro'], 'Crítica'), falta(['Pedro'], 'Leve')]), 'Pedro');
  assert.equal(pedro.cobra, 0);
  assert.equal(pedro.descuento, 1);
  assert.equal(pedro.faltas.length, 2);
});

test('una falta solo descuenta a quien afecta', () => {
  assert.equal(de(resumen([falta(['Pedro'], 'Leve')]), 'Luis').cobra, 100);
});

test('«Todos» afecta a todos, una sola vez aunque también se marque un nombre', () => {
  const filas = resumen([falta([TODOS, 'Pedro'], 'Media')]);
  assert.equal(de(filas, 'Pedro').cobra, 85);
  assert.equal(de(filas, 'Luis').cobra, 85);
});

test('una falta fuera del período no cuenta', () => {
  const pedro = de(resumen([falta(['Pedro'], 'Leve', { fecha: '2026-10-31' })]), 'Pedro');
  assert.equal(pedro.cobra, 100);
});

test('sin fecha de la falta, cuenta el día en que se registró', () => {
  const pedro = de(resumen([falta(['Pedro'], 'Leve', { fecha: '', registro: '2026-12-01' })]), 'Pedro');
  assert.equal(pedro.cobra, 100);
});

test('una falta anulada no cuenta ni se lista', () => {
  const pedro = de(resumen([falta(['Pedro'], 'Grave', { anulada: 'Marcos se equivocó de persona' })]), 'Pedro');
  assert.equal(pedro.cobra, 100);
  assert.deepEqual(pedro.faltas, []);
});

test('el monto se redondea a céntimos', () => {
  const ana = calcularResumen([{ nombre: 'Ana', bono: 50 }], PESOS, [falta(['Ana'], 'Grave')], DESDE, HASTA);
  assert.equal(ana[0].cobra, 33.33);
});

test('una gravedad que no está en la tabla de pesos es un error', () => {
  assert.throws(() => resumen([falta(['Pedro'], 'Gravísima')]), /Gravísima/);
});

// registrarFalta: valida lo que llega de afuera (página abierta) y lo deja listo para guardar.
const { registrarFalta } = require('./bono.js');
const CONTEXTO = { personas: ['Pedro', 'Luis'], gravedades: Object.keys(PESOS), hoy: '2026-11-16', abiertoDesde: '2026-11-01' };
const entrada = (extra = {}) => ({
  id: 'abc', tipo: 'De conducta', gravedad: 'Media', afecta: ['Pedro'], detalle: ' Llegó tarde ', fecha: '2026-11-16', segundos: 12, ...extra,
});

test('registrarFalta deja la falta lista para guardar', () => {
  assert.deepEqual(registrarFalta(entrada(), CONTEXTO), {
    id: 'abc', tipo: 'De conducta', gravedad: 'Media', afecta: ['Pedro'], aTodos: false, detalle: 'Llegó tarde', fecha: '2026-11-16', segundos: 12,
  });
});

test('marcar a todos guarda a cada persona de la lista de hoy y queda señalada como «a todos»', () => {
  const falta = registrarFalta(entrada({ afecta: ['Luis', 'Pedro'] }), CONTEXTO);
  assert.deepEqual(falta.afecta, ['Pedro', 'Luis']);
  assert.equal(falta.aTodos, true);
});

test('rechaza a alguien que no está en la lista de personas', () => {
  assert.throws(() => registrarFalta(entrada({ afecta: ['Pedro', 'Mario'] }), CONTEXTO), /«Mario» no está en la lista/);
});

test('rechaza una falta que no afecta a nadie', () => {
  assert.throws(() => registrarFalta(entrada({ afecta: [] }), CONTEXTO), /Elige a quién afecta/);
});

test('la fecha de la falta es obligatoria', () => {
  for (const fecha of ['', undefined, '16/11/2026']) {
    assert.throws(() => registrarFalta(entrada({ fecha }), CONTEXTO), /Elige la fecha de la falta/);
  }
});

test('la fecha de la falta no puede ser futura', () => {
  assert.throws(() => registrarFalta(entrada({ fecha: '2026-11-17' }), CONTEXTO), /no puede ser futura/);
});

test('tipo y gravedad deben ser de los permitidos', () => {
  assert.throws(() => registrarFalta(entrada({ tipo: 'Otra' }), CONTEXTO), /Elige el tipo de falta/);
  assert.throws(() => registrarFalta(entrada({ gravedad: '' }), CONTEXTO), /Elige la gravedad/);
});

test('qué pasó es obligatorio y tiene un largo razonable', () => {
  assert.throws(() => registrarFalta(entrada({ detalle: '   ' }), CONTEXTO), /Escribe qué pasó/);
  assert.throws(() => registrarFalta(entrada({ detalle: 'x'.repeat(2001) }), CONTEXTO), /muy largo/);
});

test('sin identificador no se puede evitar guardar dos veces la misma falta', () => {
  assert.throws(() => registrarFalta(entrada({ id: '' }), CONTEXTO), /recarga la página/);
});

test('los segundos son solo una medida: si llegan mal se guardan vacíos, sin frenar a Marcos', () => {
  assert.equal(registrarFalta(entrada({ segundos: 12.6 }), CONTEXTO).segundos, 13);
  assert.equal(registrarFalta(entrada({ segundos: -3 }), CONTEXTO).segundos, '');
  assert.equal(registrarFalta(entrada({ segundos: 'x' }), CONTEXTO).segundos, '');
});

test('rechaza una falta de un período ya pagado', () => {
  assert.throws(() => registrarFalta(entrada({ fecha: '2026-10-31' }), CONTEXTO), /ya se pagó/);
  assert.equal(registrarFalta(entrada({ fecha: '2026-11-01' }), CONTEXTO).fecha, '2026-11-01');
});

// siguientePeriodo: al cerrar, el período nuevo empieza al día siguiente y dura un mes.
const { siguientePeriodo } = require('./bono.js');

test('después de un mes calendario viene el mes calendario siguiente', () => {
  assert.deepEqual(siguientePeriodo('2026-11-30'), { desde: '2026-12-01', hasta: '2026-12-31' });
  assert.deepEqual(siguientePeriodo('2026-12-31'), { desde: '2027-01-01', hasta: '2027-01-31' });
  assert.deepEqual(siguientePeriodo('2027-01-31'), { desde: '2027-02-01', hasta: '2027-02-28' });
});

test('con un corte a mitad de mes, el siguiente corte es el mismo día del mes siguiente', () => {
  assert.deepEqual(siguientePeriodo('2026-11-25'), { desde: '2026-11-26', hasta: '2026-12-25' });
  assert.deepEqual(siguientePeriodo('2027-01-30'), { desde: '2027-01-31', hasta: '2027-02-28' });
});
