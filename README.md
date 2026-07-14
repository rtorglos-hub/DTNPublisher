# DTN Publisher

**DTN Publisher** es una herramienta de publicación automatizada diseñada para extraer contenido desde **Google Drive** y enviarlo a uno o dos canales de **Telegram** de forma selectiva, rápida y sin fricción.

---

## ¿Para qué sirve?

Permite gestionar un flujo de publicación editorial en tres pasos:

1. **Importar** un archivo JSON con publicaciones preparadas desde Google Drive.
2. **Revisar y seleccionar** qué publicaciones enviar, con búsqueda y filtros por categoría.
3. **Publicar o programar** en el canal de Telegram activo con un solo clic.

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

### 1. Configurar el Bot de Telegram y los canales (panel derecho)

1. Crea un bot con [@BotFather](https://t.me/botfather) en Telegram y copia el **token**.
2. Añade el bot a cada canal que quieras usar como **Administrador** con permiso de publicación de mensajes.
3. En la app, ve al panel **Integraciones** (columna derecha):
   - Pega el token en el campo **Bot Token**.
   - Escribe el **Canal 1 ID**.
   - Opcionalmente, escribe el **Canal 2 ID** si quieres publicar con el mismo bot en un segundo canal.
   - Elige el **canal activo para nuevos posts** con el selector `Canal 1` / `Canal 2`.
   - Formato de IDs:
     - Canales públicos: `@nombre_del_canal`
     - Canales privados: reenvía un mensaje del canal a [@RawDataBot](https://t.me/rawdatabot) y copia el `chat id` (empieza por `-100`).
4. Pulsa **Guardar y Validar** — la app verificará el token en tiempo real con la API de Telegram y mostrará el nombre del bot si es correcto.

> **Asignación de canal**: los posts programados conservan el canal que estaba activo en el momento de programarlos. Si programas posts con `Canal 1`, después cambias a `Canal 2` y programas más posts, la cola quedará mezclada correctamente: cada publicación se enviará al canal que tenía asignado al entrar en la cola.

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
- Pulsa **Enviar (N)** para publicar las seleccionadas inmediatamente en el canal activo.
- Pulsa **Programar (N)** para añadirlas a la cola usando el canal activo en ese momento.

> **Persistencia**: La bandeja de entrada se almacena localmente en el navegador (`localStorage`) de tu dispositivo. Al cerrar sesión, recargar la página o cerrar el navegador, los posts de la bandeja no desaparecerán.

> **Cola de programados**: cada tarjeta de la cola muestra una etiqueta `Canal 1` o `Canal 2`, además del estado (`Pendiente`, `Enviado` o `Fallido`). Esta etiqueta indica el destino real que usará el Worker Scheduler.

### 4. Limpieza Automática de Publicaciones Enviadas (panel derecho)

- En la sección **Limpieza Automática** puedes configurar el intervalo de días (por ejemplo, `10` días) tras el cual los posts que ya fueron enviados con éxito se borrarán automáticamente de la base de datos D1.
- Pulsa **Guardar Configuración de Limpieza** para persistir el valor.
- Configurar el valor en `0` (o dejarlo vacío) desactivará por completo la limpieza automática.
- Esta limpieza es ejecutada periódicamente en segundo plano por el Worker Scheduler.

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
Ponle el nombre `dtnpblisher` y ejecuta las migraciones:

```bash
npx wrangler d1 migrations apply dtnpblisher --remote
```

O pega el contenido de las migraciones de [`migrations/`](migrations/) en la consola SQL de D1, en orden.

Migraciones actuales:

| Archivo | Descripción |
|---------|-------------|
| `0000_init.sql` | Crea la tabla `config` con token, canal principal y enlace de Drive |
| `0001_schedule.sql` | Añade configuración horaria y crea `scheduled_posts` |
| `0002_auto_delete.sql` | Añade `auto_delete_days` |
| `0003_second_channel.sql` | Añade segundo canal y guarda el canal asignado a cada post programado |

Si tu base ya existía antes de la versión con segundo canal, aplica:

```sql
ALTER TABLE config ADD COLUMN channel_id_2 TEXT;
ALTER TABLE config ADD COLUMN selected_channel TEXT DEFAULT 'primary';

ALTER TABLE scheduled_posts ADD COLUMN channel_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN channel_label TEXT;

UPDATE scheduled_posts
SET
  channel_id = (SELECT channel_id FROM config WHERE id = 1),
  channel_label = 'Canal 1'
WHERE channel_id IS NULL OR channel_id = '';
```

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

#### 4. Configurar Variables de Autenticación
Para asegurar la aplicación, configura dos variables en **Settings** > **Variables** > **Environment variables** (tanto en Producción como en Preview):
- `AUTH_EMAIL`: El correo de acceso (ej. `admin@example.com`).
- `AUTH_PASSWORD`: La contraseña de acceso.

#### 5. Re-desplegar
Haz un push al repositorio o dispara un deploy manual desde el panel para que los cambios surtan efecto.

---

## Worker Scheduler (Programador Cron)

La aplicación utiliza un Cloudflare Worker adicional para ejecutar el programador de envíos de forma automática:
- **URL del Worker:** `https://dtn-publisher-scheduler.retroregalos.workers.dev/`
- **Proyecto:** Ubicado en la carpeta `worker-scheduler/`.
- **Funcionamiento:** Se ejecuta mediante un disparador Cron cada 15 minutos (configurable en `worker-scheduler/wrangler.jsonc`) para enviar los posts pendientes que coincidan con la ventana horaria configurada y realizar tareas de mantenimiento como la limpieza automática de posts antiguos.
- **Destino de envío:** cada post programado se envía al `channel_id` guardado en `scheduled_posts`. Si un post antiguo no tiene canal guardado, el Worker usa como respaldo el canal principal de `config`.
- **Despliegue del Worker:**
  ```bash
  cd worker-scheduler
  npx wrangler deploy
  ```

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

### Variables de entorno obligatorias y opcionales

Crea un archivo `.env` en la raíz si necesitas configuración adicional:

```env
# Obligatorias para la autenticación
AUTH_EMAIL=admin@dtn.com
AUTH_PASSWORD=admin

# Opcional: solo necesario para leer carpetas completas de Drive
GDRIVE_API_KEY=
```

---

## API Endpoints (Pages Functions)

> **Nota**: Todos los endpoints (excepto `/api/login` y `/api/logout`) están protegidos mediante middleware y requieren autenticación válida a través de la cookie `session_token` o la cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/login` | Valida credenciales y genera cookie/token de sesión |
| `POST` | `/api/logout` | Cierra la sesión y borra la cookie `session_token` |
| `GET` | `/api/health` | Verifica la conexión con la base de datos D1 |
| `GET` | `/api/config` | Obtiene la configuración guardada (bot token, canal 1, canal 2, canal activo, drive url, horario y limpieza) |
| `POST` | `/api/config` | Guarda la configuración en D1 |
| `POST` | `/api/drive/fetch` | Descarga y normaliza el JSON desde Google Drive |
| `POST` | `/api/telegram/send` | Envía las publicaciones seleccionadas al canal activo indicado |
| `GET` | `/api/telegram/schedule` | Lista la cola de posts programados |
| `POST` | `/api/telegram/schedule` | Programa publicaciones y guarda en cada una su canal de destino |
| `DELETE` | `/api/telegram/schedule?id=...` | Elimina un post de la cola |
| `POST` | `/api/telegram/test` | Valida el bot token con la API de Telegram (`getMe`) |

---

## Instalación como App (PWA)

DTN Publisher es una **Progressive Web App (PWA)** y puede instalarse en la pantalla de inicio de tu dispositivo Android como si fuera una app nativa.

### Requisitos
- Google Chrome en Android (versión 76+).
- Haber accedido al menos una vez a la aplicación para que se registre el Service Worker.

### Instalación
1. Abre la aplicación en Chrome Android.
2. Espera unos segundos a que aparezca el banner **"Añadir a pantalla de inicio"** en la parte inferior de la pantalla y pulsa **Instalar**.
3. Si no aparece el banner, abre el menú ⋮ (tres puntos) > **Instalar app**.
4. Confirma en el diálogo de instalación.

La aplicación aparecerá en tu pantalla de inicio con el icono ⚡ y se abrirá en modo **standalone** (sin la barra de direcciones del navegador).

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
│   ├── 0000_init.sql       # Esquema inicial de la base de datos D1
│   ├── 0001_schedule.sql   # Cola y configuración de programación
│   ├── 0002_auto_delete.sql        # Limpieza automática
│   └── 0003_second_channel.sql     # Segundo canal y canal por post programado
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
