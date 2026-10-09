# cron-jobs

Automatizaciones y reportes programados para uso personal, ejecutados periódicamente mediante GitHub Actions y scripts locales, con notificaciones automáticas por Telegram y WhatsApp.

## Módulos y scripts

| Script | Descripción | Destino |
| :--- | :--- | :--- |
| `daily-jobs-report` | Recolecta ofertas laborales multi-fuente según un perfil, las evalúa con Google Gemini y notifica a diario las más afines, ordenadas por afinidad y pago estimado. Ver [Perfiles del reporte de empleos](#perfiles-del-reporte-de-empleos). | Telegram |
| `daily-deals-report` | Monitorea y recopila ofertas destacadas de tiendas de tecnología y electrodomésticos. | Telegram |
| `daily-financial-report` | Consulta gastos pendientes en el backend y envía un resumen de pagos. | WhatsApp |

### Comandos de desarrollo

```bash
# Instalación de dependencias
npm install

# Búsqueda de empleos (modo local con .env), indicando el perfil
npm run daily-jobs-report -- alejandro-exactas
npm run daily-jobs-report -- mariana

# Test de extracción de empleos de un perfil (sin invocar la IA)
npm run daily-jobs-report-test -- mariana

# Ofertas comerciales
npm run daily-deals-report

# Reporte financiero
npm run daily-financial-report
```

### Tests

```bash
npm test            # tests unitarios
npm run typecheck   # chequeo de tipos
```

Los tests son unitarios, usan el runner nativo de Node (`node:test`) y viven junto al código (`*.test.ts`). Cubren la lógica propia que puede romperse sin que se note: filtros y parseo de cada fuente, selección de modelos y filtrado de resultados de Gemini, y formatos de cada perfil. No se conectan a ningún servicio: `fetch` se simula con respuestas armadas a partir de las reales (`test-helpers/mockFetch.ts`), y `test-helpers/blockNetwork.ts` hace fallar cualquier request que un test no haya simulado. El workflow `tests.yml` los corre en cada push y pull request, sin descargar el Chrome de Puppeteer porque los tests no lo usan.

Quedan fuera los scrapers de `daily-deals-report`, que extraen los datos dentro de un navegador real con Puppeteer.

Los scripts `*-test` (por ejemplo `daily-jobs-report-test`) no son tests automatizados: son chequeos manuales que consultan los sitios y APIs reales (sin enviar mensajes ni invocar la IA) para ver qué devuelve cada fuente hoy, así que los corre el programador.

## Perfiles del reporte de empleos

`daily-jobs-report` se ejecuta para un perfil (`daily-jobs-report/profiles/`). Cada perfil define sus fuentes de ofertas, los criterios que Gemini usa para evaluarlas, cómo se muestra el pago y el chat de Telegram de destino; la consulta a Gemini, el ranking y el armado del mensaje se comparten.

| Perfil | Búsqueda | Fuentes | Pago mostrado | Ofertas por día |
| :--- | :--- | :--- | :--- | :--- |
| `alejandro` | Desarrollo frontend/full stack, remoto o en CABA y alrededores | Get on Board, RemoteOK, Remotive | USD/hora y su equivalente en ARS | 1 |
| `alejandro-exactas` | Puestos para estudiantes de Ciencias de la Computación afines a desarrollo de software, remoto o en CABA y alrededores | Exactas UBA | USD/hora y su equivalente en ARS | Todas las nuevas |
| `mariana` | Comercio, caja, atención al cliente, ayudante de cocina y cuidado de personas mayores, remoto o en CABA y alrededores | Bumeran, Computrabajo | ARS/mes | 3 |

Bumeran se consulta mediante la API interna que usa su propio sitio y Computrabajo leyendo sus páginas públicas, ya que ninguno ofrece una API pública; un cambio en esos sitios puede romper la extracción sin aviso.

Exactas UBA se lee de la página pública de [ofertas activas para estudiantes](https://exactas.uba.ar/ofertas-de-trabajo-profesional/ofertas-activas-estudiantes/) de la Facultad de Ciencias Exactas y Naturales, que reúne ofertas de todas sus carreras. Las que ya pasaron su fecha de cierre (la página puede seguir mostrándolas) se descartan antes de consultar a Gemini, y la carrera pedida la evalúa Gemini. Si la página no tiene ninguna oferta reconocible, el script falla y avisa el error, porque lo más probable es un cambio en su formato.

Un perfil puede recordar las ofertas ya evaluadas (`seenJobsStateFile`) para mandar solo las nuevas, sin tope, en vez de repetir cada día las mismas hasta su cierre; `alejandro-exactas` lo usa. Cada oferta pasa por Gemini una sola vez, aunque no haya resultado afín. El estado se guarda en `daily-jobs-report/state/` (ignorada por git) y el workflow lo persiste entre corridas en el cache de GitHub Actions. Si el cache se pierde (GitHub lo borra tras 7 días sin usarse), la corrida siguiente vuelve a evaluar y avisar las ofertas activas. Si el envío a Telegram falla, el estado no se actualiza y esas ofertas se reintentan al día siguiente (si el reporte iba partido en varios mensajes, se repiten también las de los que sí llegaron). Si el archivo de estado se corrompe, el perfil falla en cada corrida hasta borrar su cache (`seen-jobs-<perfil>-run-…`) en Actions > Caches. Al correrlo localmente, el estado local es independiente del de GitHub. Los mensajes que superan el límite de Telegram se parten en varios.

Las fuentes de `mariana` prefiltran por zona de forma amplia y la cercanía real la evalúa Gemini: Bumeran deja pasar los remotos y lo publicado en CABA o Provincia de Buenos Aires, y Computrabajo busca solo en CABA, porque su búsqueda por ubicación no permite incluir el conurbano sin incluir toda la provincia. Cada fuente alterna entre sus búsquedas (cajera, vendedora, etc.) para que ninguna llene sola el tope. Los topes (20 en Bumeran, 15 en Computrabajo, más bajo porque cada oferta requiere consultar su página de detalle) suman las 35 ofertas que Gemini evalúa como máximo.

Para agregar un perfil: crear su archivo en `profiles/`, registrarlo en `profiles/index.ts`, sumarlo en el workflow (a las opciones del input `profile` y a la lista por defecto de la `matrix`) y cargar su variable de chat en `.env` y en los Secrets. El workflow corre un job por perfil, de a uno por vez porque comparten la cuota de Gemini, y si uno falla el resto igual se envía. El cron corre los perfiles de la lista por defecto de la `matrix`; al ejecutarlo a mano ("Run workflow") se puede elegir uno solo, incluso uno que no esté en esa lista. `alejandro` está pausado: no figura en la lista por defecto, pero su código se mantiene y se reactiva volviendo a sumarlo ahí.

El repositorio es público: los perfiles no deben incluir datos personales (documento, teléfono, mail, dirección exacta). Los CV usados como referencia (`cv-*.pdf`) están ignorados por git.

## Variables de entorno

El proyecto lee variables desde el archivo `.env` en desarrollo o desde los Secrets del entorno `cron` en GitHub Actions:

- `TELEGRAM_BOT_TOKEN`: Token del bot de Telegram provisto por BotFather.
- `TELEGRAM_CHAT_ID`: Identificador de chat o canal de Telegram receptor. También recibe los avisos de error de todos los perfiles del reporte de empleos.
- `TELEGRAM_CHAT_ID_MARIANA`: Chat de Mariana para el reporte de empleos. Telegram solo permite que el bot le escriba después de que ella le envíe `/start`.
- `GEMINI_API_KEY`: Clave de API de Google Gemini para el filtrado inteligente de empleos.
- `GEMINI_MODEL`: (Opcional) Modelo específico de Gemini a forzar. Por defecto, el sistema consulta dinámicamente la API de Google y selecciona/conmuta automáticamente entre los mejores modelos disponibles: solo versiones 3 o superiores, primero los Flash, luego los Flash-Lite y por último los Pro, de la versión más nueva a la más vieja. Se pasa al modelo siguiente cuando uno agota su cuota (en el plan gratuito, la cuota diaria es por modelo) o devuelve una respuesta vacía o inválida; si ninguno responde bien, la corrida falla y avisa el error.
- `WHATSAPP_PHONE`: Número de teléfono destino para avisos de WhatsApp (CallMeBot).
- `WHATSAPP_API_KEY`: Clave de API de CallMeBot.
- `URL_BACKEND`: Endpoint del backend para consulta de finanzas.
- `CRON_API_KEY`: Clave de autorización del backend financiero.

## Automatización en GitHub Actions

Los workflows ubicados en `.github/workflows/` están configurados con triggers de tipo `schedule` (cron UTC) y `workflow_dispatch` (ejecución manual). Se ejecutan en runners `ubuntu-latest` con Node.js 24.
