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
      personas: [{ nombre: 'Pedro', rol: 'Montacarguistas' }, { nombre: 'Luis', rol: 'Montacarguistas' }, { nombre: 'Ana', rol: 'Ayudantes' }],
      gravedades: [{ gravedad: 'Leve', texto: 'Leve · 5 %' }, { gravedad: 'Media', texto: 'Media · 50 %' }, { gravedad: 'Grave', texto: 'Grave · 100 %' }],
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

const verNombres = (page, rol) => page.locator('.grupo', { hasText: rol }).getByRole('button').click();

async function llenar(page) {
  await page.getByLabel('De conducta').check();
  await page.getByLabel('Media').check();
  await page.getByLabel('Todos').check();
  await verNombres(page, 'Ayudantes');
  await page.getByLabel('Ana').uncheck();
  await page.getByLabel('¿Qué pasó?').fill('Llegó tarde');
  await page.getByRole('button', { name: 'Hoy' }).click();
}

const enviadas = (page) => page.evaluate(() => window.enviadas);

test('«Todos» marca a todos, y desmarcar a uno desmarca «Todos»', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Todos').check();
  for (const nombre of ['Pedro', 'Luis', 'Ana']) await expect(page.getByLabel(nombre)).toBeChecked();
  await verNombres(page, 'Montacarguistas');
  await page.getByLabel('Luis').uncheck();
  await expect(page.getByLabel('Todos')).not.toBeChecked();
  await expect(page.getByLabel('Pedro')).toBeChecked();
  await page.getByLabel('Luis').check();
  await expect(page.getByLabel('Todos')).toBeChecked();
});

test('un grupo se marca de un golpe, y desmarcar a uno desmarca el grupo', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Montacarguistas').check();
  await expect(page.getByLabel('Pedro')).toBeChecked();
  await expect(page.getByLabel('Luis')).toBeChecked();
  await expect(page.getByLabel('Ana')).not.toBeChecked();
  await expect(page.getByLabel('Todos')).not.toBeChecked();
  await verNombres(page, 'Ayudantes');
  await page.getByLabel('Ana').check();
  await expect(page.getByLabel('Todos')).toBeChecked();
  await verNombres(page, 'Montacarguistas');
  await page.getByLabel('Luis').uncheck();
  await expect(page.getByLabel('Montacarguistas')).not.toBeChecked();
  await expect(page.getByLabel('Todos')).not.toBeChecked();
});

test('los nombres de cada grupo están plegados hasta que se piden', async ({ page }) => {
  await abrir(page);
  await expect(page.getByLabel('Pedro')).toBeHidden();
  const boton = page.locator('.grupo', { hasText: 'Montacarguistas' }).getByRole('button');
  await expect(boton).toHaveText(/0 de 2/);
  await boton.click();
  await expect(page.getByLabel('Pedro')).toBeVisible();
  await page.getByLabel('Pedro').check();
  await expect(boton).toHaveText(/1 de 2/);
});

test('dice a cuántos afecta antes de enviar', async ({ page }) => {
  await abrir(page);
  await expect(page.getByText('Todavía no marcaste a nadie')).toBeVisible();
  await verNombres(page, 'Montacarguistas');
  await page.getByLabel('Pedro').check();
  await expect(page.getByText('Afecta a 1 persona')).toBeVisible();
  await page.getByLabel('Todos').check();
  await expect(page.getByText('Afecta a todos (3)')).toBeVisible();
});

test('cada gravedad muestra cuánto quita, según la hoja', async ({ page }) => {
  await abrir(page);
  await expect(page.getByLabel('Grave · 100 %')).toBeVisible();
  await expect(page.getByText('Crítica')).toHaveCount(0);
});

test('sin fecha no se envía; «Ayer» la llena', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('De conducta').check();
  await page.getByLabel('Leve').check();
  await verNombres(page, 'Montacarguistas');
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
