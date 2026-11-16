# Bono por desempeño — Faltas (Induvenpa)

Apuesta 1 de CEB-388 (Project P-CEB-44 en Linear): Marcos registra faltas en una página y la hoja calcula cuánto bono cobra cada persona. Vocabulario en `CONTEXT.md`; decisiones en `docs/adr/`.

- `dominio/bono.js`: las reglas, sin Google (`registrarFalta`, `calcularResumen`). Pruebas: `npm test`.
- `adaptadores/hoja.js`: la hoja (Personas, Pesos, Faltas, Estado del bono, Pagado …) y el menú **Bono** (actualizar estado, cerrar período).
- `adaptadores/web.js` + `pagina.html`: la página de Marcos. Pruebas de la página: `npm run e2e`.
- Cuenta dueña: tecnologia@induvenpa.com (`clasp -u induvenpa`). Al crear con clasp, el manifiesto vuelve a America/New_York: revisarlo.
- Publicar: `npm test && npm run e2e`, `clasp -u induvenpa push` y `clasp -u induvenpa deploy -i <id de la implementación>` (así el enlace de Marcos no cambia).
