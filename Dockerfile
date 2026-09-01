FROM node:20-bookworm-slim AS base

# Configurar variables de entorno para pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Instalar dependencias del sistema operativo (OCR, PDF, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copiar el código fuente (excluyendo lo innecesario vía .dockerignore si existiera,
# pero en Docker copiamos todo primero)
COPY . .

# Instalar las dependencias usando pnpm
RUN pnpm install --frozen-lockfile

# Compilar solo el servidor API y sus librerías
RUN pnpm run typecheck:libs || true
RUN pnpm --filter @workspace/api-server run build

# Exponer el puerto
EXPOSE 8080

# Iniciar la aplicación
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
