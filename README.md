# Komanda API

Backend da plataforma Komanda, construído com NestJS, TypeScript, PostgreSQL e Prisma ORM.

## Stack

- **Runtime:** Node.js 20+ LTS
- **Framework:** NestJS 11
- **Linguagem:** TypeScript 5.7
- **Banco de dados:** PostgreSQL 16
- **ORM:** Prisma 7
- **Infraestrutura:** Docker / Docker Compose

## Pré-requisitos

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- npm

## Configuração inicial

**1. Clone o repositório e instale as dependências**
```bash
npm install
```

**2. Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

**3. Suba o banco de dados**
```bash
npm run db:up
```

**4. Execute as migrations**
```bash
npm run db:migrate
```

**5. Suba o app**
```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api`.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL | `postgresql://komanda:komanda123@localhost:5432/komanda_db` |
| `JWT_SECRET` | Segredo usado para assinar os JWT. **Obrigatório**, mínimo 32 caracteres | — |
| `PASSWORD_RESET_TOKEN_PEPPER` | Pepper do hash dos tokens de reset de senha. **Obrigatório**, mínimo 32 caracteres | — |
| `NODE_ENV` | Ambiente da aplicação | `development` |
| `PORT` | Porta do servidor HTTP | `3000` |
| `CORS_ORIGIN` | Origem permitida pelo CORS | `*` |
| `DB_POOL_SIZE` | Máx. de conexões do pool por processo | `10` |

`JWT_SECRET` e `PASSWORD_RESET_TOKEN_PEPPER` não têm valor padrão e o boot falha se estiverem ausentes ou tiverem menos de 32 caracteres. Gere cada um com:

```bash
openssl rand -base64 48
```

## Comandos

### App

```bash
npm run start:dev      # Desenvolvimento com hot-reload
npm run start:prod     # Produção (requer build)
npm run build          # Compila para /dist
```

### Banco de dados

```bash
npm run db:up          # Liga o PostgreSQL no Docker
npm run db:down        # Desliga o PostgreSQL
npm run db:migrate     # Cria e aplica uma nova migration
npm run db:generate    # Regenera o Prisma Client
npm run db:studio      # Abre o Prisma Studio (localhost:5555)
npm run db:reset       # Apaga e recria o banco (apenas dev)
```

> Ao modificar o `prisma/schema.prisma`, rode `npm run db:migrate` e informe um nome descritivo para a migration (ex: `add_table_orders`).

### Qualidade de código

```bash
npm run lint           # ESLint com autocorreção
npm run format         # Prettier em todos os arquivos
```

### Testes

```bash
npm run test           # Testes unitários
npm run test:watch     # Testes em modo watch
npm run test:cov       # Cobertura de testes
npm run test:e2e       # Testes end-to-end
```

### NestJS CLI

```bash
nest g resource nome   # Gera module + controller + service + DTOs
nest g module nome     # Gera um módulo
nest g service nome    # Gera um service
nest g controller nome # Gera um controller
```

## Chat em tempo real (WebSocket)

A API expõe um gateway WebSocket para chat pós-match entre profissional aprovado e restaurante dono da vaga.

### Conexão

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: '<JWT_ACCESS_TOKEN>' },
  transports: ['websocket'],
});
```

### Eventos

| Direção | Evento | Payload | Ack |
|---|---|---|---|
| C→S | `chat:join` | `{ jobId, take? }` | `{ ok: true, messages, hasMore }` |
| C→S | `chat:leave` | `{ jobId }` | `{ ok: true }` |
| C→S | `chat:send` | `{ jobId, content }` | `{ ok: true, message }` |
| C→S | `chat:history` | `{ jobId, before?, take? }` | `{ ok: true, messages, hasMore }` |
| S→C | `chat:message` | `MessageResponseDto` | — (broadcast na room) |
| S→C | `chat:error` | `{ statusCode, message }` | — (erro fora de request, ex.: rate limit) |

**Exemplo `chat:send`:**
```javascript
socket.emit('chat:send', { jobId: 'uuid-da-vaga', content: 'Olá!' }, (ack) => {
  if (ack.ok) {
    console.log('Enviado:', ack.message);
  } else {
    console.error('Erro:', ack.error);
  }
});
```

**Recebendo mensagens (broadcast):**
```javascript
socket.on('chat:message', (msg) => {
  console.log('Nova mensagem:', msg.content, 'de', msg.senderId);
});
```

### Regras de acesso

- Só entra na room e envia/listar mensagens quem:
  - É o **restaurante dono da vaga** (`job.restaurantId === userId`), OU
  - É **profissional com candidatura APROVADA** naquela vaga.
- Qualquer outra tentativa retorna `403` no ack: `"Só é possível conversar após uma candidatura aprovada na vaga"`.

### Paginação de histórico

- `chat:join` e `chat:history` aceitam `take` (padrão 50, máx 100).
- `chat:history` aceita `before` (ISO 8601 `createdAt`) para scroll para trás.
- Resposta sempre em ordem **cronológica ascendente** (mais antiga primeiro).
- `hasMore: true` indica que há mais mensagens anteriores.

### Rate limiting

- Janela deslizante: **20 eventos / 10 segundos** por socket.
- Exceder retorna ack com `{ ok: false, error: { statusCode: 429, message: 'Muitas requisições...' } }` e emite `chat:error`.

### Reconexão

- Em caso de queda, reconecte com token válido (renovado se expirado) e chame `chat:join` novamente — o histórico retorna o que faltou.
- JWT expira no meio da conexão: o socket não cai sozinho; cliente deve monitorar `exp` e reconectar proativamente.

### Estrutura do projeto

```
src/
├── config/            # Validação de variáveis de ambiente
├── prisma/            # PrismaModule e PrismaService globais
├── app.module.ts      # Módulo raiz
└── main.ts            # Bootstrap da aplicação

prisma/
├── schema.prisma      # Schema do banco de dados
├── migrations/        # Histórico de migrations
└── ...

prisma.config.js       # Configuração do Prisma CLI (v7)
docker-compose.yml     # Serviços Docker (PostgreSQL)
```
