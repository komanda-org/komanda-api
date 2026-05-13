# Komanda API

Backend da plataforma de conexão entre profissionais da gastronomia e restaurantes.

## Stack

- NestJS + TypeScript
- PostgreSQL
- Docker

## Como rodar

# Subir o banco
docker-compose up -d

# Instalar dependências
npm install

# Rodar migrations
npx prisma migrate dev

# Iniciar o servidor
npm run start:dev