# Bono por desempeño

Registro de faltas de supervisores, montacarguistas, ayudantes y cocineras de Induvenpa, y cálculo de cuánto bono cobra cada uno en el período.

## Language

**Bono**:
Monto fijo que cobra una **Persona** por período si no tiene **Faltas**; hoy es igual para todos.
_Avoid_: incentivo, premio

**Persona**:
Alguien de la pestaña Personas: cobra el **Bono**. Marcos (quien registra) no es una Persona.
_Avoid_: trabajador, empleado, montacarguista (es solo un rol)

**Falta**:
Hecho que Marcos registra y que baja el **Bono** de las **Personas** que afecta.
_Avoid_: castigo, sanción, multa

**Tipo de falta**:
Categoría de la **Falta**; por ahora solo «De conducta». El detalle va en texto libre: no hay catálogo de faltas.

**Gravedad**:
Leve, media o grave; cada una tiene un **Peso**. Hasta el 17-nov-2026 existió «crítica» (100 %); la grave la reemplazó.

**Peso**:
Porcentaje del **Bono** completo que quita una **Falta** de esa **Gravedad** (desde el 17-nov-2026: leve 5 %, media 50 %, grave 100 %); se ajusta en la pestaña Pesos.
_Avoid_: castigo, multa

**Descuento**:
Suma de los **Pesos** de las **Faltas** de una **Persona** en el **Período**, con tope de 100 %.

**Período**:
Rango de días (Desde–Hasta) que cubre un **Estado del bono**; por defecto, el mes.
_Avoid_: quincena, corte

**Estado del bono**:
El estado del bono: lo que cobraría cada **Persona** si el **Período** cerrara ahora, y por qué, con la nota de Marcos en cada **Falta**; se recalcula solo.
_Avoid_: reporte

**Fecha de la falta**:
El día en que pasó; obligatoria y nunca futura. Distinta del **Registro**.

**Registro**:
Momento en que Marcos envió la **Falta**; con la **Fecha de la falta** mide si anota al momento.

**Cierre**:
El día de pago: deja una copia congelada del estado del bono (pestaña «Pagado …») y abre el **Período** siguiente.
_Avoid_: corte (es la fecha Hasta, no el acto)

**Anulada**:
**Falta** que no cuenta, con el motivo escrito; nunca se borra.
_Avoid_: borrada, eliminada

## Relationships

- Una **Falta** afecta a una o más **Personas** y tiene exactamente una **Gravedad**
- Una **Falta** «a todos» afecta a cada **Persona** de la lista del día en que se registró, no a quien entre después (ADR-0002)
- El **Descuento** nunca pasa de 100 %, pero las **Faltas** se siguen anotando
- Una **Falta** cuenta en el **Período** que contiene su **Fecha de la falta**, no su **Registro**
- Una **Falta** con fecha de un **Período** ya cerrado se rechaza: lo pagado no cambia (decidido por Jorge, 16-nov-2026)
- Después de un **Cierre**, el **Período** nuevo empieza al día siguiente y corta el mismo día del mes siguiente

## Example dialogue

> **Dev:** "Si Marcos registra hoy una **Falta** grave de la semana pasada, ¿en qué **Período** cuenta?"
> **Jorge:** "En el que contiene la **Fecha de la falta**. El **Registro** solo sirve para medir si anota tarde."

## Flagged ambiguities

- «castigo» se usó para la **Falta** y para el **Peso** — resuelto: la **Falta** es el hecho; el **Peso** es cuánto quita.
