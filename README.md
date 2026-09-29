# cron-jobs

Automatizaciones y reportes programados para uso personal, ejecutados periódicamente mediante GitHub Actions y scripts locales, con notificaciones automáticas por Telegram y WhatsApp.

## Módulos y scripts

| Script | Descripción | Destino |
| :--- | :--- | :--- |
| `daily-jobs-report` | Recolecta ofertas tech multi-fuente (Get on Board, RemoteOK y Remotive), las evalúa con Google Gemini y notifica a diario el Top 3 según afinidad y remuneración horaria estimada (ARS/USD). | Telegram |
| `daily-deals-report` | Monitorea y recopila ofertas destacadas de tiendas de tecnología y electrodomésticos. | Telegram |
| `daily-financial-report` | Consulta gastos pendientes en el backend y envía un resumen de pagos. | WhatsApp |

### Comandos de desarrollo

```bash
# Instalación de dependencias
npm install

# Búsqueda de empleos (modo local con .env)
npm run daily-jobs-report

# Test de extracción de empleos (sin invocar la IA)
npm run daily-jobs-report-test

# Ofertas comerciales
npm run daily-deals-report

# Reporte financiero
npm run daily-financial-report
```

## Variables de entorno

El proyecto lee variables desde el archivo `.env` en desarrollo o desde los Secrets del entorno `cron` en GitHub Actions:

- `TELEGRAM_BOT_TOKEN`: Token del bot de Telegram provisto por BotFather.
- `TELEGRAM_CHAT_ID`: Identificador de chat o canal de Telegram receptor.
- `GEMINI_API_KEY`: Clave de API de Google Gemini para el filtrado inteligente de empleos.
- `GEMINI_MODEL`: (Opcional) Modelo específico de Gemini a forzar. Por defecto, el sistema consulta dinámicamente la API de Google y selecciona/conmuta automáticamente entre los mejores modelos disponibles.
- `WHATSAPP_PHONE`: Número de teléfono destino para avisos de WhatsApp (CallMeBot).
- `WHATSAPP_API_KEY`: Clave de API de CallMeBot.
- `URL_BACKEND`: Endpoint del backend para consulta de finanzas.
- `CRON_API_KEY`: Clave de autorización del backend financiero.

## Automatización en GitHub Actions

Los workflows ubicados en `.github/workflows/` están configurados con triggers de tipo `schedule` (cron UTC) y `workflow_dispatch` (ejecución manual). Se ejecutan en runners `ubuntu-latest` con Node.js 24.
