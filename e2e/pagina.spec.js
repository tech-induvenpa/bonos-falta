// Prueba de caja negra de la página: el servidor de Apps Script (google.script.run) se simula,
// así que no toca la hoja real. La prueba contra la página publicada se hace aparte.
const { test, expect } = require('@playwright/test');
const path = require('node:path');

const PAGINA = 'file://' + path.resolve(__dirname, '../adaptadores/pagina.html');

async function abrir(page, { fallarPrimerEnvio = false } = {}) {
  await page.addInitScript((fallar) => {
    window.enviadas = [];
    let fallos = fallar ? 1 : 0;
    const datos = {
      personas: ['Pedro', 'Luis', 'Ana'], gravedades: ['Leve', 'Media', 'Grave', 'Crítica'],
      tipos: ['De conducta'], hoy: '2026-11-16', ayer: '2026-11-15',
    };
    const runner = () => {
      let ok = () => {};
      const r = {
        withSuccessHandler(f) { ok = f; return r; },
        withFailureHandler() { return r; },
        datosDePagina() { setTimeout(() => ok(datos)); },
        guardarFalta(e) {
          setTimeout(() => {
            window.enviadas.push(e);
            ok(fallos-- > 0 ? { error: 'No se pudo guardar. Intenta de nuevo en un momento.' } : { ok: true });
          });
        },
      };
      return r;
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get: runner });
  }, fallarPrimerEnvio);
  await page.goto(PAGINA);
}

async function llenar(page) {
  await page.getByLabel('De conducta').check();
  await page.getByLabel('Media').check();
  await page.getByLabel('Todos').check();
  await page.getByLabel('Ana').uncheck();
  await page.getByLabel('¿Qué pasó?').fill('Llegó tarde');
  await page.getByRole('button', { name: 'Hoy' }).click();
}

const enviadas = (page) => page.evaluate(() => window.enviadas);

test('«Todos» marca a todos, y desmarcar a uno desmarca «Todos»', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Todos').check();
  for (const nombre of ['Pedro', 'Luis', 'Ana']) await expect(page.getByLabel(nombre)).toBeChecked();
  await page.getByLabel('Luis').uncheck();
  await expect(page.getByLabel('Todos')).not.toBeChecked();
  await expect(page.getByLabel('Pedro')).toBeChecked();
  await page.getByLabel('Luis').check();
  await expect(page.getByLabel('Todos')).toBeChecked();
});

test('sin fecha no se envía; «Ayer» la llena', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('De conducta').check();
  await page.getByLabel('Leve').check();
  await page.getByLabel('Pedro').check();
  await page.getByLabel('¿Qué pasó?').fill('Pelea');
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  expect(await enviadas(page)).toEqual([]);
  await page.getByRole('button', { name: 'Ayer' }).click();
  await expect(page.getByLabel('Otra fecha')).toHaveValue('2026-11-15');
});

test('registra la falta con lo que eligió Marcos', async ({ page }) => {
  await abrir(page);
  await llenar(page);
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  await expect(page.getByText('Falta registrada.')).toBeVisible();
  const [falta] = await enviadas(page);
  expect(falta).toMatchObject({
    tipo: 'De conducta', gravedad: 'Media', afecta: ['Pedro', 'Luis'], detalle: 'Llegó tarde', fecha: '2026-11-16',
  });
  expect(falta.id).toBeTruthy();
  expect(typeof falta.segundos).toBe('number');
});

test('si el envío falla, reintentar manda la misma falta y no la duplica', async ({ page }) => {
  await abrir(page, { fallarPrimerEnvio: true });
  await llenar(page);
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  await expect(page.getByText('No se pudo guardar. Intenta de nuevo en un momento.')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  await expect(page.getByText('Falta registrada.')).toBeVisible();
  const [primera, segunda] = await enviadas(page);
  expect(segunda.id).toBe(primera.id);
});

test('«Registrar otra» empieza en blanco y es otra falta', async ({ page }) => {
  await abrir(page);
  await llenar(page);
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  await page.getByRole('button', { name: 'Registrar otra' }).click();
  await expect(page.getByLabel('Todos')).not.toBeChecked();
  await expect(page.getByLabel('Otra fecha')).toHaveValue('');
  await llenar(page);
  await page.getByRole('button', { name: 'Registrar falta' }).click();
  await expect(page.getByText('Falta registrada.')).toBeVisible();
  const [primera, segunda] = await enviadas(page);
  expect(segunda.id).not.toBe(primera.id);
});
