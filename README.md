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
| `RATE_LIMIT` | Limite padrão de requisições por rota/IP na janela | `20` |
| `RATE_LIMIT_TTL_SECONDS` | Tamanho da janela do rate limit HTTP, em segundos | `60` |
| `AUTH_LOGIN_LIMIT` | Tentativas de login por IP na janela | `5` |
| `AUTH_LOGIN_TTL_SECONDS` | Janela do limite de login, em segundos | `60` |
| `TRUST_PROXY_HOPS` | Nº de proxies confiáveis à frente da API (X-Forwarded-For). `0` = sem proxy | `0` |
| `DB_POOL_SIZE` | Máx. de conexões do pool por processo | `10` |

`JWT_SECRET` e `PASSWORD_RESET_TOKEN_PEPPER` não têm valor padrão e o boot falha se estiverem ausentes ou tiverem menos de 32 caracteres. Gere cada um com:

```bash
openssl rand -base64 48
```

## Rate limiting (HTTP)

O `ThrottlerGuard` é global (`APP_GUARD`), então toda rota HTTP tem limite. O contador é **por rota + IP** (GET e POST na mesma URL não compartilham cota) e os headers `X-RateLimit-Limit/Remaining/Reset` acompanham a resposta; exceder devolve `429`.

| Rota | Limite |
|---|---|
| `POST /auth/recover-password` | 3/min |
| `POST /auth/login` | `AUTH_LOGIN_LIMIT` (5/min) |
| `POST /auth/reset-password` | 5/min |
| `POST /restaurants`, `POST /professionals` | 5/min |
| `POST /denuncias` | 10/min |
| `POST /jobs`, `POST /jobs/:id/applications`, `POST /users/reviews` | 10/min |
| Demais rotas (GET/PUT/PATCH/DELETE) | `RATE_LIMIT` (20/min) |

Limites por rota ficam em `@Throttle({ default: { limit, ttl } })` nos controllers; o padrão vem de `RATE_LIMIT`/`RATE_LIMIT_TTL_SECONDS`.

Além do throttle, `POST /auth/recover-password` tem cooldown de 60s **por e-mail** (checado no banco via `password_reset_tokens`), que vale entre instâncias e impede e-mail bombing/invalidação de tokens em flood.

### Atrás de proxy (Traefik/Nginx)

O tracker do throttle usa `req.ip`. Sem `trust proxy`, atrás de um proxy todos os clientes aparecem com o IP do proxy e passam a compartilhar o mesmo balde. `TRUST_PROXY_HOPS` é o **número de proxies entre o cliente e a API**:

- Traefik sozinho na frente da API → `TRUST_PROXY_HOPS=1`
- Cloudflare + Traefik → `TRUST_PROXY_HOPS=2` (o número cresce a cada proxy adicional)

```bash
TRUST_PROXY_HOPS=1   # um Traefik/Nginx na frente
```

- Valor **menor** que o real: todos os usuários acabam identificados pelo IP de um proxy e dividem **um único balde** de rate limit.
- Valor **maior** que o real: o app passa a confiar em posições do `X-Forwarded-For` que o cliente controla, permitindo forjar o IP e **burlar o limite**.

No Traefik, o limite grosso por IP combina com o do app (defesa em camadas). Use `depth: 1` para o Traefik também enxergar o cliente real:

```yaml
http:
  middlewares:
    api-ratelimit:
      rateLimit:
        average: 60        # 60 requisições...
        burst: 20          # ...com burst de 20
        period: 1m
        sourceCriterion:
          ipStrategy:
            depth: 1       # IP do cliente no X-Forwarded-For
```

### Limitações conhecidas

- **Storage do throttler em memória, por instância:** com N réplicas o limite efetivo é N×. Para limite distribuído, usar storage Redis (o `rateLimit` do Traefik também é por instância).
- **Limite por IP + rota, sem usuário/e-mail:** usuários atrás de NAT/CGNAT (empresa, escola, operadora) dividem a mesma cota; endpoints de leitura refeitos com frequência podem gerar 429 legítimo.
- **Cooldown de recuperação de senha sem transação:** duas requisições simultâneas podem passar pelo `findFirst` antes do `create` (race condition), mitigada pelo limite de 3/min em `recover-password`; e a consulta por `(user_id, created_at)` não tem índice.
- **Swagger (`/api/docs`) fora do guard global:** é registrado pelo `SwaggerModule` direto no adapter HTTP, então não passa pelo `ThrottlerGuard`.
- **WebSocket com limite próprio por socket:** 20 eventos/10 s por `socket.id`, sem limite de handshake/conexão (e o contador zera ao reconectar).

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
