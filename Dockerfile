# Build stage
FROM node:20-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Instala todas as dependências para o build
RUN npm install

COPY . .

# Define variável dummy para o build (necessário para o prisma.config.ts)
ENV DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy"

# Gera o cliente Prisma
RUN npx prisma generate

# Compila a aplicação
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Instala netcat para verificar conexão com banco
RUN apk add --no-cache netcat-openbsd

COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --only=production

# Copia artefatos do build
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

# Script de inicialização
CMD ["sh", "-c", "echo '⏳ Aguardando MySQL...' && while ! nc -z mysql 3306; do sleep 1; done && echo '✅ MySQL conectado!' && echo '🛠️ Aplicando migrations...' && npx prisma db push --accept-data-loss && echo '🚀 Iniciando aplicação...' && node dist/src/main"]

