# Dominio puro y adaptadores, sin repositorio ni CQRS

Las reglas viven en `dominio/bono.js` como dos funciones puras (`registrarFalta`, `calcularResumen`) que reciben los datos ya leídos; la hoja, la página y el formulario viejo son adaptadores. No hay agregados, comandos, eventos ni una interfaz de repositorio: Apps Script no tiene módulos ni inyección de dependencias, y con un solo almacén (la hoja) un puerto de repositorio sería una costura hipotética. Cuando llegue un segundo almacén (la app propia de la apuesta 3), se agrega su adaptador y recién ahí la costura.
