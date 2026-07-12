# DTN Publisher

**DTN Publisher** es una herramienta de publicación automatizada diseñada para extraer contenido desde **Google Drive** y enviarlo a canales de **Telegram** de forma selectiva, rápida y sin fricción.

---

## ¿Para qué sirve?

Permite gestionar un flujo de publicación editorial en tres pasos:

1. **Importar** un archivo JSON con publicaciones preparadas desde Google Drive.
2. **Revisar y seleccionar** qué publicaciones enviar, con búsqueda y filtros por categoría.
3. **Publicar** en un canal de Telegram con un solo clic.

---

## Arquitectura

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| **Frontend** | React 19 + Vite + Tailwind v4 | SPA con diseño Neo-brutalista |
| **Backend** | Cloudflare Pages Functions | Endpoints serverless en TypeScript |
| **Base de datos** | Cloudflare D1 (SQLite) | Almacena la configuración del bot |
| **Deploy** | Cloudflare Pages | Build automático desde GitHub |

---

## Flujo de uso

### 1. Configurar el Bot de Telegram (panel derecho)

1. Crea un bot con [@BotFather](https://t.me/botfather) en Telegram y copia el **token**.
2. Añade el bot a tu canal como **Administrador** con permiso de publicación de mensajes.
3. En la app, ve al panel **Integraciones** (columna derecha):
   - Pega el token en el campo **Bot Token**.
   - Escribe el **Channel ID**:
     - Canales públicos: `@nombre_del_canal`
     - Canales privados: reenvía un mensaje del canal a [@RawDataBot](https://t.me/rawdatabot) y copia el `chat id` (empieza por `-100`).
4. Pulsa **Guardar y Validar** — la app verificará el token en tiempo real con la API de Telegram y mostrará el nombre del bot si es correcto.

### 2. Conectar Google Drive (panel izquierdo)

- Comparte el archivo JSON de forma pública ("Cualquier persona con el enlace puede ver").
- Pega la URL en el campo **Enlace a Carpeta o Archivo**.
- Pulsa **Guardar Link** para persistir la URL en la base de datos.
- Pulsa **Descargar JSON** para cargar las publicaciones.

> **Nota**: La descarga funciona directamente con el enlace de compartición de Google Drive sin necesidad de API Key.

### 3. Revisar y publicar (panel central)

- Las publicaciones se muestran en tarjetas con título, resumen y categoría.
- Utiliza la **barra de búsqueda** para filtrar por texto en tiempo real.
- Usa las **píldoras de categorías** para filtrar por tipo de contenido.
- Pulsa **Vista Previa** en cualquier tarjeta para ver el mensaje formateado antes de enviar.
- Pulsa **Copiar** para copiar el mensaje al portapapeles para uso manual.
- Selecciona una o varias publicaciones mediante los checkboxes.
- Pulsa **Seleccionar Todo** para seleccionar todas las visibles (filtradas).
- Pulsa **Enviar (N)** para publicar las seleccionadas en el canal de Telegram.

---

## Formato del JSON de Google Drive

El archivo JSON puede tener dos estructuras soportadas:

**Estructura 1 — Array directo:**
```json
[
  {
    "title": "Título del post",
    "summary": "Descripción breve...",
    "link": "https://fuente.com/articulo",
    "category": "tecnología"
  }
]
```

**Estructura 2 — Objeto con propiedad `posts` (formato DTN):**
```json
{
  "meta": { "canal": "Mi Canal" },
  "posts": [
    {
      "fuente_nombre": "El País",
      "texto_telegram": "<b>Título</b>\n\nContenido listo para Telegram...",
      "fuente_url": "https://elpais.com/...",
      "categoria": "vigilancia_biometrica"
    }
  ]
}
```

La app normaliza automáticamente ambos formatos y mapea los campos (`fuente_nombre` → `title`, `texto_telegram` → `summary`, etc.).

---

## Plantilla de Envío

La plantilla define cómo se formatea el mensaje antes de enviarse. Las variables disponibles son:

| Variable | Campo del JSON | Descripción |
|----------|---------------|-------------|
| `{texto_telegram}` | `texto_telegram` / `summary` | Mensaje preformateado completo |
| `{fuente_nombre}` | `fuente_nombre` / `title` | Nombre de la fuente o título |
| `{fuente_url}` | `fuente_url` / `link` | URL del artículo original |
| `{categoria}` | `categoria` / `category` | Categoría del contenido |
| `{title}` | `title` / `fuente_nombre` | Alias de fuente_nombre |
| `{summary}` | `summary` / `texto_telegram` | Alias de texto_telegram |
| `{link}` | `link` / `fuente_url` | Alias de fuente_url |
| `{category}` | `category` / `categoria` | Alias de categoria |

**Plantilla por defecto** (usa el mensaje preformateado directamente):
```
{texto_telegram}
```

---

## Despliegue en Cloudflare Pages

### Prerrequisitos
- Cuenta de [Cloudflare](https://cloudflare.com) con acceso a **Workers & Pages** y **D1**.
- Repositorio en GitHub.

### Pasos

#### 1. Crear la base de datos D1
En el panel de Cloudflare, ve a **Workers & Pages** > **D1** > **Create database**.
Ponle el nombre `dtnpblisher` y ejecuta la migración inicial:

```bash
npx wrangler d1 migrations apply dtnpblisher --remote
```

O pega el contenido de [`migrations/0000_init.sql`](migrations/0000_init.sql) en la consola SQL de D1.

#### 2. Configurar el proyecto de Pages
1. En Cloudflare, ve a **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Selecciona tu repositorio.
3. Configura el build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Guarda y despliega.

#### 3. Vincular la base de datos D1
Ve a **Settings** > **Functions** > **D1 database bindings**:
- **Variable name**: `DB`
- **D1 database**: selecciona `dtnpblisher`

#### 4. Re-desplegar
Haz un push al repositorio o dispara un deploy manual desde el panel para que los cambios surtan efecto.

---

## Desarrollo local

### Prerrequisitos
- Node.js 18+

### Instalación

```bash
git clone <tu-repositorio>
cd DTN-Publisher
npm install
```

### Ejecución con Wrangler (simula Cloudflare Pages localmente)

```bash
# Compilar el frontend
npm run build

# Levantar el entorno local con D1 emulada
npx wrangler pages dev dist --d1 DB
```

La app estará disponible en `http://127.0.0.1:8788`.

### Variables de entorno opcionales

Crea un archivo `.env` en la raíz si necesitas configuración adicional:

```env
GDRIVE_API_KEY=   # Opcional: solo necesario para leer carpetas completas de Drive
```

---

## API Endpoints (Pages Functions)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Verifica la conexión con la base de datos D1 |
| `GET` | `/api/config` | Obtiene la configuración guardada (bot token, channel id, drive url) |
| `POST` | `/api/config` | Guarda la configuración en D1 |
| `POST` | `/api/drive/fetch` | Descarga y normaliza el JSON desde Google Drive |
| `POST` | `/api/telegram/send` | Envía las publicaciones seleccionadas al canal de Telegram |
| `POST` | `/api/telegram/test` | Valida el bot token con la API de Telegram (`getMe`) |

---

## Estructura del proyecto

```
DTN-Publisher/
├── functions/              # Cloudflare Pages Functions (backend)
│   └── api/
│       ├── config.ts       # GET/POST configuración
│       ├── health.ts       # Health check de D1
│       ├── drive/
│       │   └── fetch.ts    # Descarga desde Google Drive
│       └── telegram/
│           ├── send.ts     # Envío a Telegram
│           └── test.ts     # Validación del bot token
├── migrations/
│   └── 0000_init.sql       # Esquema inicial de la base de datos D1
├── src/
│   ├── App.tsx             # Componente principal de la interfaz
│   ├── drive.ts            # Lógica de descarga y normalización de Drive
│   ├── telegram.ts         # Lógica de envío a Telegram
│   ├── main.tsx            # Punto de entrada de React
│   └── index.css           # Estilos globales
├── index.html              # HTML base
├── vite.config.ts          # Configuración de Vite
├── wrangler.jsonc          # Configuración de Cloudflare Wrangler
└── package.json
```
