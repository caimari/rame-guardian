# RAME Guardian: guía exacta de la demostración

Esta guía explica exactamente qué botón pulsar, qué sección revisar y qué demuestra cada resultado visible. No se necesita cuenta, contraseña, clave de API ni instalación.

- Demo pública: <https://guardian.ramesystem.com>
- Vídeo de la candidatura: <https://vimeo.com/1241378616>
- Navegador recomendado: una ventana privada o de incógnito nueva
- Recorrido principal: ocho botones guiados y una recarga final

## Preparación

1. Abre la demo pública.
2. Selecciona **Recovery Studio** en la navegación de tres pestañas.
3. Si quieres ver la interfaz en español, utiliza el selector de idioma de la cabecera.
4. Pulsa **Reset demo**, situado en la cabecera inmediatamente a la izquierda del selector de idioma.
5. Confirma las tres señales iniciales:
   - **Autoridad actual** indica **Sin inicializar**.
   - La guía indica **Siguiente paso: 1 · Autorizar y crear base de 12h**.
   - Solo el paso 1 está destacado y muestra **Pulsa ahora**.

Pulsa únicamente el botón destacado. Los pasos terminados reciben una marca y el texto **Completado**. Los botones pálidos están desactivados y todavía no deben pulsarse.

## Qué significa cada sección

- **Autoridad actual**: la última decisión de disponibilidad autorizada por el usuario. `12h · v1` significa 12 horas, versión 1 de la decisión.
- **STATE GRAPH — Trabajo y compromisos**: los cuatro resultados duraderos y sus versiones. La versión de un resultado solo cambia después de una confirmación correcta.
- **APPROVAL ENVELOPE — Cambiado / Conservado**: los cambios exactos propuestos o confirmados, junto con el trabajo humano y los resultados que deben permanecer intactos.
- **APPEND-ONLY — Rastro de evidencias**: la secuencia persistente de creación de la base, borradores, aprobaciones, rechazos y aplicaciones.
- **CONTROL GROUP — Control protegido equivalente**: comparación final del esfuerzo de recuperación y las evidencias. No es necesario revisarla después de cada botón.

Estados de un borrador:

- `pending`: propuesto, pero todavía no aprobado.
- `approved`: el borrador exacto ha sido autorizado, pero aún no ha modificado el trabajo duradero.
- `stale`: sus supuestos han quedado obsoletos y se ha rechazado.
- `applied`: la reparación aprobada se ha confirmado.

## Paso 1 — Autorizar y crear la base de 12 horas

Pulsa **1 · Autorizar y crear base de 12h**.

Comprueba:

- **Autoridad actual:** `12h · v1`.
- **Plan de entrega v1:** 12 horas disponibles; distribución `Core build · 6h`, `Validation · 3h`, `Demo · 3h`; modo `full`.
- **Propuesta para el cliente v1:** precio `€2,600`; accesibilidad `WCAG AAA checkout`; alcance completo para el 30 de octubre.
- **Panel de ejecución v1:** `Architecture audit` está `done`; checkout y formación están `todo`.
- **Nota de investigación independiente v1:** `reviewed · No availability dependency`.
- **Rastro de evidencias:** aparece `Baseline Initialized`.

Significado: estos son los compromisos que Guardian debe mantener coherentes. El precio es una edición aprobada por el usuario, la accesibilidad es una condición obligatoria, la auditoría es trabajo ya terminado y la investigación no depende de las horas disponibles.

## Paso 2 — Pedir a Nemotron un borrador antiguo de seis horas

Pulsa **2 · Pedir a Super borrador de 6h** y espera a que termine la inferencia real.

En **Cambiado / Conservado**, comprueba:

- Estado: `pending · 6h`.
- La vista previa reduce el plan, limita el compromiso de entrega y aplaza la formación pendiente.
- El precio, la accesibilidad, la auditoría terminada y la investigación independiente permanecen sin cambios.
- Los cuatro resultados duraderos continúan en `v1`.
- **Rastro de evidencias:** aparece `Draft Created`.

Significado: Nemotron ha propuesto una reparación, pero una propuesta no es una autorización y todavía no ha escrito ningún resultado duradero.

## Paso 3 — Aprobar el borrador antiguo

Pulsa **3 · Aprobar borrador antiguo**.

Comprueba:

- El estado cambia de `pending · 6h` a `approved · 6h`.
- **Rastro de evidencias:** aparece `Draft Approved` con un hash de aprobación.
- Todos los resultados siguen en `v1` y su contenido permanece igual.

Significado: la aprobación vincula el borrador exacto con la decisión y las versiones revisadas. Aprobar todavía no significa ejecutar.

## Paso 4 — Autorizar una decisión nueva de ocho horas

Pulsa **4 · Sesión B: autorizar 8h**.

Comprueba:

- **Autoridad actual** avanza de `12h · v1` a `8h · v2`.
- El borrador aprobado de seis horas continúa vinculado a la decisión `v1`.
- Los cuatro resultados duraderos permanecen en `v1`.

Significado: ahora existe una decisión más reciente. El borrador anterior ha quedado obsoleto, aunque fuese válido cuando se aprobó.

## Paso 5 — Intentar aplicar el borrador obsoleto

Pulsa **5 · Aplicar borrador obsoleto**.

Este paso debe ser rechazado. Que el paso 5 aparezca con una marca de **Completado** significa que la prueba de protección ha funcionado; no significa que el borrador antiguo se haya aplicado.

Comprueba las tres pruebas:

1. El aviso verde indica que el borrador obsoleto fue rechazado antes de ejecutarse.
2. **Cambiado / Conservado** muestra **0 de 4 resultados cambiados · 0 escrituras parciales** y **No se modificó ningún trabajo**.
3. **Rastro de evidencias** añade `Stale Rejected`.

Confirma también que todos los resultados siguen en `v1` y que la autoridad continúa en `8h · v2`.

Significado: Guardian volvió a consultar la autoridad vigente en el momento de ejecutar y rechazó la operación completa, en vez de aplicar parcialmente una reparación preparada con la versión 1.

## Paso 6 — Recuperar desde el estado vigente

Pulsa **6 · Recuperar estado actual** y espera a Nemotron.

En **Cambiado / Conservado**, comprueba que el nuevo borrador está en `pending · 8h` y que su instantánea de decisión utiliza `v2`.

La columna **Cambiado** muestra exactamente tres resultados afectados:

- **Plan de entrega:** trabajo disponible `12 → 8`; distribución `6/3/3 → 4/2/2`; modo `full → focused`.
- **Propuesta para el cliente:** solo cambia el compromiso de entrega, que pasa a un alcance concentrado con formación asíncrona.
- **Panel de ejecución:** la formación pendiente cambia de `todo → async` y sale de la ruta crítica de entrega.

La columna **Conservado** debe mostrar:

- Precio aprobado: `€2,600`.
- Accesibilidad: `WCAG AAA checkout`.
- Trabajo terminado: `Architecture audit · done`.
- Resultado independiente: `reviewed · No availability dependency`.

Los cuatro resultados duraderos deben seguir en `v1`, porque todavía es una vista previa. El **Rastro de evidencias** añade otro evento `Draft Created`.

Significado: Nemotron interpreta el conflicto actual y propone la reparación; Guardian la limita a los campos dependientes de la autoridad y presenta la diferencia exacta para que el usuario la revise.

## Paso 7 — Aprobar la reparación vigente exacta

Pulsa **7 · Aprobar reparación exacta**.

Comprueba:

- Estado: `approved · 8h`.
- Los mismos cambios y compromisos conservados continúan visibles.
- **Rastro de evidencias:** aparece un nuevo `Draft Approved`.
- Los cuatro resultados duraderos todavía siguen en `v1`.

Significado: el usuario ha autorizado esta reparación exacta contra la decisión `v2` y las versiones base revisadas. Todavía no se ha escrito ningún resultado.

## Paso 8 — Confirmar atómicamente

Pulsa **8 · Confirmar atómicamente**.

Comprueba el resultado final:

1. La guía indica **8 / 8 — Escenario completado**.
2. El aviso indica **Selective repair committed atomically**.
3. **Trabajo y compromisos** muestra:
   - Plan de entrega: `v2`, ahora con 8 horas y distribución `4/2/2`.
   - Propuesta para el cliente: `v2`, con el compromiso actualizado, pero conservando el precio y la accesibilidad.
   - Panel de ejecución: `v2`, manteniendo la auditoría en `done` y trasladando la formación a modo asíncrono.
   - Nota de investigación independiente: continúa en `v1` y sin modificaciones.
4. **Cambiado / Conservado** se presenta como el resultado verificado después de la confirmación y sigue mostrando los compromisos protegidos.
5. **Rastro de evidencias** añade `Applied` e indica tres escrituras atómicas.

Significado: exactamente los tres resultados dependientes cambiaron juntos. El resultado independiente y el trabajo humano protegido no cambiaron.

## Comprobación de persistencia

Pulsa **Recargar estado duradero**.

Las versiones y los valores finales deben seguir iguales después de que el servidor vuelva a leer el estado. Esta recarga no vuelve a llamar al modelo ni crea otra reparación.

El menú **Pruebas avanzadas (opcionales)** no forma parte del recorrido principal. Contiene comprobaciones adicionales de concurrencia e idempotencia para revisores técnicos.

## Lista final de éxito

- Autoridad vigente: `8h · v2`.
- Operación antigua de seis horas: rechazada con `0 escrituras parciales`.
- Actualizados atómicamente: plan de entrega, propuesta para el cliente y panel de ejecución.
- Conservados exactamente: `€2,600`, `WCAG AAA checkout`, auditoría terminada e investigación independiente.
- Versiones finales: tres resultados dependientes en `v2`; resultado independiente en `v1`.
- La recarga conserva el estado final.

Nemotron propone; Guardian valida las versiones y los campos protegidos; el usuario aprueba; solo entonces la reparación exacta puede convertirse en trabajo duradero.
