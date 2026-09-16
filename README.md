# API de Controle Financeiro Pessoal

API REST em Node.js + Express 5 + TypeScript + Prisma, criada para ser consumida por um
frontend rodando no Vite (`http://localhost:5173`). Ela expõe receitas, despesas e o saldo.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL (padrão) ou MySQL rodando localmente

## Como rodar

```bash
# 1. instalar as dependências
npm install

# 2. criar o arquivo .env a partir do exemplo
cp .env.example .env        # no Windows: copy .env.example .env

# 3. ajustar a DATABASE_URL no .env com seu usuário/senha

# 4. criar as tabelas no banco
npx prisma db push

# 5. subir a API em modo desenvolvimento
npm run dev
```

A API sobe em **http://localhost:3001**. Ao iniciar, o seed insere 8 receitas e 8 despesas
(somente se as tabelas estiverem vazias — reiniciar não duplica os dados).

Para produção: `npm run build` e depois `npm start`.

### Usando MySQL em vez de PostgreSQL

1. Em `prisma/schema.prisma`, troque `provider = "postgresql"` por `provider = "mysql"`.
2. No `.env`, use a URL do MySQL (há um exemplo comentado em `.env.example`).
3. Rode `npx prisma db push` novamente.

## Endpoints

| Método | Rota             | Status de sucesso | Descrição                                   |
| ------ | ---------------- | ----------------- | ------------------------------------------- |
| GET    | `/receitas`      | 200               | Lista receitas (aceita `?categoria=`)       |
| GET    | `/receitas/:id`  | 200               | Busca uma receita                           |
| POST   | `/receitas`      | 201               | Cria uma receita                            |
| PUT    | `/receitas/:id`  | 200               | Atualiza uma receita                        |
| DELETE | `/receitas/:id`  | 204               | Remove uma receita (sem corpo na resposta)  |
| GET    | `/despesas`      | 200               | Lista despesas (aceita `?categoria=`)       |
| GET    | `/despesas/:id`  | 200               | Busca uma despesa                           |
| POST   | `/despesas`      | 201               | Cria uma despesa                            |
| PUT    | `/despesas/:id`  | 200               | Atualiza uma despesa                        |
| DELETE | `/despesas/:id`  | 204               | Remove uma despesa                          |
| GET    | `/saldo`         | 200               | Totais e saldo                              |

### Formato dos registros

```json
{
  "id": 1,
  "descricao": "Salario de setembro",
  "valor": 4200,
  "categoria": "Salario",
  "data": "2026-09-05T00:00:00.000Z",
  "criadoEm": "2026-09-16T12:00:00.000Z"
}
```

### Resposta de `/saldo`

```json
{ "totalReceitas": 9278.25, "totalDespesas": 2861.75, "saldo": 6416.5 }
```

### Corpo aceito em POST e PUT

```json
{
  "descricao": "Venda de monitor",
  "valor": 450.0,
  "categoria": "Vendas",
  "data": "2026-09-15"
}
```

Regras: `descricao` entre 3 e 100 caracteres, `valor` numérico maior que zero,
`categoria` não vazia e `data` em formato reconhecível (`YYYY-MM-DD`).

### Erro de validação (400)

```json
{
  "erro": "Dados invalidos.",
  "campos": {
    "descricao": "A descricao e obrigatoria e deve ter ao menos 3 caracteres.",
    "valor": "O valor deve ser maior que zero."
  }
}
```

### Erro de id inexistente (404)

```json
{ "erro": "Receita nao encontrada." }
```

## Testando

O arquivo `requests.http` cobre todas as rotas, incluindo os casos de 400 e 404.
Basta abrir no VS Code com a extensão **REST Client** e clicar em *Send Request*.

## Onde cada requisito foi atendido

| Requisito do enunciado                              | Arquivo                                   |
| --------------------------------------------------- | ----------------------------------------- |
| Node.js 20+, Express 5, TypeScript                  | `package.json`, `tsconfig.json`           |
| Prisma com PostgreSQL/MySQL                         | `prisma/schema.prisma`, `src/prisma.ts`   |
| CORS liberado para `http://localhost:5173`          | `src/app.ts`                              |
| Porta 3001                                          | `src/server.ts`, `.env.example`           |
| CRUD de receitas                                    | `src/rotas/receitas.ts`                   |
| CRUD de despesas                                    | `src/rotas/despesas.ts`                   |
| `GET /saldo`                                        | `src/rotas/saldo.ts`                      |
| Validação com `{ erro, campos }` e 400              | `src/validacao.ts` + rotas                |
| 404 quando o id não existe                          | rotas de receitas e despesas              |
| Status 200 / 201 / 204 / 400 / 404                  | rotas + `src/middlewares/erros.ts`        |
| Seed com 8 receitas e 8 despesas ao iniciar         | `src/seed.ts`, chamado em `src/server.ts` |
| Atraso artificial de 400 ms nos GET                 | `src/middlewares/delay.ts`                |
| README e `requests.http`                            | este arquivo e `requests.http`            |

## Estrutura

```
src/
├── server.ts            sobe o servidor e roda o seed
├── app.ts               Express, CORS, middlewares e rotas
├── prisma.ts            instância única do PrismaClient
├── seed.ts              dados de exemplo
├── validacao.ts         validação de corpo e de id
├── middlewares/
│   ├── delay.ts         400 ms nos GET
│   └── erros.ts         404 de rota e handler de erro
└── rotas/
    ├── receitas.ts
    ├── despesas.ts
    └── saldo.ts
```
