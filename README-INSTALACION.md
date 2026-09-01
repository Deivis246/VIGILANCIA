# Vigilancia Calderón — instalación en otro computador

Este paquete contiene el código fuente del dashboard web, el API, la transcripción local de censos, los clientes API generados, el esquema PostgreSQL y el módulo opcional de predicción con Gemini.

## Requisitos

- Node.js 20 o superior.
- pnpm 10 o superior.
- PostgreSQL 14 o superior y una base de datos vacía.
- Herramientas OCR instaladas y disponibles en `PATH`:
  - `pdftoppm` y `pdftotext` (Poppler).
  - `tesseract` con los idiomas español e inglés.
  - `convert` y `gs` (ImageMagick y Ghostscript) como respaldo para PDF.

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-client \
  poppler-utils tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng \
  imagemagick ghostscript
sudo npm install --global pnpm@10
```

### macOS

```bash
brew install node pnpm postgresql poppler tesseract-lang imagemagick ghostscript
```

En Windows se recomienda instalar Ubuntu mediante WSL2 y seguir los pasos de Ubuntu/Debian, porque la transcripción usa esas herramientas de consola.

## Instalación

1. Descomprime el ZIP y abre una terminal en la carpeta creada.
2. Instala las dependencias exactas del lockfile:

```bash
pnpm install --frozen-lockfile
```

3. Crea una base PostgreSQL y copia la configuración de ejemplo:

```bash
cp .env.example .env
```

Edita `.env` y completa:

- `DATABASE_URL`: conexión a PostgreSQL.
- `GOOGLE_GEMINI_API_KEY`: clave de Google AI Studio. El API la necesita al iniciar, aunque la transcripción de censos funciona con OCR local y no envía el censo a Gemini.

4. Crea/actualiza las tablas:

```bash
pnpm --filter @workspace/db run push
```

5. Inicia el API y el frontend:

```bash
./start-local.sh
```

6. Abre en el navegador:

- Dashboard: http://127.0.0.1:5173/
- Transcripción: http://127.0.0.1:5173/transcripcion
- Salud del API: http://127.0.0.1:8080/api/healthz

La transcripción se ejecuta localmente con Poppler/Tesseract. El archivo cargado se procesa temporalmente y no se conserva en el servidor. La revisión humana antes de guardar es obligatoria.

## Comandos útiles

```bash
# Comprobaciones
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/vigilancia-calderon run typecheck
pnpm --filter @workspace/api-server run test:census

# Builds de producción
PORT=8080 pnpm --filter @workspace/api-server run build
PORT=5173 BASE_PATH=/ API_ORIGIN=http://127.0.0.1:8080 \
  pnpm --filter @workspace/vigilancia-calderon run build
```

## Privacidad

El lector omite columnas y etiquetas de nombre, paciente, cédula, teléfono e historia clínica. No se muestran ni se guardan esos valores. Aun así, para uso real conviene anonimizar los documentos antes de cargarlos y mantener la revisión clínica/epidemiológica.
