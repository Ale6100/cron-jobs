# cron-jobs

Automatizaciones y reportes programados para uso personal, ejecutados periódicamente mediante GitHub Actions y scripts locales, con notificaciones automáticas por Telegram y WhatsApp.

## Módulos y scripts

| Script | Descripción | Destino |
| :--- | :--- | :--- |
| `daily-jobs-report` | Recolecta ofertas laborales multi-fuente según un perfil, las evalúa con Google Gemini y notifica a diario el Top 3 según afinidad y pago estimado. Ver [Perfiles del reporte de empleos](#perfiles-del-reporte-de-empleos). | Telegram |
| `daily-deals-report` | Monitorea y recopila ofertas destacadas de tiendas de tecnología y electrodomésticos. | Telegram |
| `daily-financial-report` | Consulta gastos pendientes en el backend y envía un resumen de pagos. | WhatsApp |

### Comandos de desarrollo

```bash
# Instalación de dependencias
npm install

# Búsqueda de empleos (modo local con .env), indicando el perfil
npm run daily-jobs-report -- alejandro
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

Los tests son unitarios, usan el runner nativo de Node (`node:test`) y viven junto al código (`*.test.ts`). Cubren la lógica propia que puede romperse sin que se note: filtros y parseo de cada fuente, selección de modelos y filtrado de resultados de Gemini, y formatos de cada perfil. No se conectan a ningún servicio: `fetch` se simula con respuestas armadas a partir de las reales (`test-helpers/mockFetch.ts`), y `test-helpers/blockNetwork.ts` hace fallar cualquier request que un test no haya simulado. El workflow `tests.yml` los corre en cada push y pull request.

Quedan fuera los scrapers de `daily-deals-report`, que extraen los datos dentro de un navegador real con Puppeteer.

Los scripts `*-test` (por ejemplo `daily-jobs-report-test`) no son tests automatizados: son chequeos manuales que consultan los sitios y APIs reales (sin enviar mensajes ni invocar la IA) para ver qué devuelve cada fuente hoy, así que los corre el programador.

## Perfiles del reporte de empleos

`daily-jobs-report` se ejecuta para un perfil (`daily-jobs-report/profiles/`). Cada perfil define sus fuentes de ofertas, los criterios que Gemini usa para evaluarlas, cómo se muestra el pago y el chat de Telegram de destino; la consulta a Gemini, el ranking y el armado del mensaje se comparten.

| Perfil | Búsqueda | Fuentes | Pago mostrado |
| :--- | :--- | :--- | :--- |
| `alejandro` | Desarrollo frontend/full stack, remoto o en CABA y alrededores | Get on Board, RemoteOK, Remotive | USD/hora y su equivalente en ARS |
| `mariana` | Comercio, caja, atención al cliente, ayudante de cocina y cuidado de personas mayores, remoto o en CABA y alrededores | Bumeran, Computrabajo | ARS/mes |

Bumeran se consulta mediante la API interna que usa su propio sitio y Computrabajo leyendo sus páginas públicas, ya que ninguno ofrece una API pública; un cambio en esos sitios puede romper la extracción sin aviso.

Para agregar un perfil: crear su archivo en `profiles/`, registrarlo en `profiles/index.ts`, sumarlo a la `matrix` del workflow y cargar su variable de chat en `.env` y en los Secrets. El workflow corre un job por perfil, de modo que si uno falla el resto igual se envía.

El repositorio es público: los perfiles no deben incluir datos personales (documento, teléfono, mail, dirección exacta). Los CV usados como referencia (`cv-*.pdf`) están ignorados por git.

## Variables de entorno

El proyecto lee variables desde el archivo `.env` en desarrollo o desde los Secrets del entorno `cron` en GitHub Actions:

- `TELEGRAM_BOT_TOKEN`: Token del bot de Telegram provisto por BotFather.
- `TELEGRAM_CHAT_ID`: Identificador de chat o canal de Telegram receptor. También recibe los avisos de error de todos los perfiles del reporte de empleos.
- `TELEGRAM_CHAT_ID_MARIANA`: Chat de Mariana para el reporte de empleos. Telegram solo permite que el bot le escriba después de que ella le envíe `/start`.
- `GEMINI_API_KEY`: Clave de API de Google Gemini para el filtrado inteligente de empleos.
- `GEMINI_MODEL`: (Opcional) Modelo específico de Gemini a forzar. Por defecto, el sistema consulta dinámicamente la API de Google y selecciona/conmuta automáticamente entre los mejores modelos disponibles.
- `WHATSAPP_PHONE`: Número de teléfono destino para avisos de WhatsApp (CallMeBot).
- `WHATSAPP_API_KEY`: Clave de API de CallMeBot.
- `URL_BACKEND`: Endpoint del backend para consulta de finanzas.
- `CRON_API_KEY`: Clave de autorización del backend financiero.

## Automatización en GitHub Actions

Los workflows ubicados en `.github/workflows/` están configurados con triggers de tipo `schedule` (cron UTC) y `workflow_dispatch` (ejecución manual). Se ejecutan en runners `ubuntu-latest` con Node.js 24.
