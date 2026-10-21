# MeuSaldo — API financeira

API REST em Express 5, TypeScript, Prisma 6 e PostgreSQL, consumida pelo frontend
Next.js irmão em `controle_financeiro/meusaldo`. API local: porta 3001.

## Executar

Requer Node.js 20+ com npm e um PostgreSQL disponível (validado com PostgreSQL 16).
Clone este repositório como irmão de
[controle_financeiro](https://github.com/joaozitoito/controle_financeiro), conforme o
[roteiro do workspace](https://github.com/joaozitoito/controle_financeiro#executar).

Em uma instalação nova do PostgreSQL, crie um usuário próprio e bases separadas.
Exemplo com `psql`, conectado como administrador local; não repetir em objetos já existentes:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -W
```

No terminal do psql:

```sql
CREATE ROLE meusaldo LOGIN;
\password meusaldo
CREATE DATABASE meusaldo_dev OWNER meusaldo;
CREATE DATABASE meusaldo_test OWNER meusaldo;
\q
```

`\password` solicita a senha sem escrevê-la no comando ou neste repositório.
Se o servidor/usuário/bases já existirem, use a configuração autorizada desse ambiente.
A base `_test` é exclusiva para testes; o usuário precisa poder criar schemas nela
para testar migrações. Nenhum desses comandos é executado automaticamente pela aplicação.

Dentro de `backend_meusaldo`, configure o ambiente novo:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Substituir o marcador de DATABASE_URL pelo acesso local autorizado.
npm run prisma:generate
npm run db:migrate
npm run dev
```

Não sobrescreva um .env existente. `npm run build` compila TypeScript;
`npm start` executa o código compilado. O servidor conecta ao banco antes de
escutar e fica em 127.0.0.1. Falha de conexão encerra a inicialização com mensagem
de diagnóstico sem imprimir a URL/credenciais.
O lockfile acompanha o projeto: use npm ci para reproduzir as dependências.
`npm run prisma:generate` é explícito para instalações que não executam scripts
automáticos. O pacote argon2 usa binário nativo; se não houver binário para a sua
plataforma, sua instalação exige as ferramentas de compilação indicadas pelo pacote.

`DATABASE_URL` é privada do backend. `PORT` tem padrão 3001.
Os arquivos .env.example/.env.test.example contêm somente marcadores, sem senha
funcional. Substitua-os localmente; caracteres especiais na senha da URL exigem
percent-encoding. Não publique .env, .env.test, cookies ou a URL preenchida.
`CORS_ORIGINS` permite origens exatas separadas por vírgula, sem barra final;
padrão `http://localhost:3000`. Se usar 127.0.0.1 no navegador, adicione essa origem.
Não há curinga de CORS. O frontend usa `NEXT_PUBLIC_API_URL=http://localhost:3001`.
Cookies exigem `credentials: include`. Use o mesmo host para ambos os serviços
locais (localhost nas duas URLs). Produção exige HTTPS, NODE_ENV=production e
CORS_ORIGINS explícito; a implantação não faz parte desta fase.

O ambiente local já preparado durante as fases usa um PostgreSQL Docker dedicado, container
`meusaldo-fase2-postgres`, volume `meusaldo-fase2-data`, porta local 5437 e bases
`meusaldo_dev` e `meusaldo_test`. Esses recursos e arquivos privados não são
distribuídos pelo Git; um clone limpo usa o preparo acima. Para retomar somente esse ambiente existente:
`docker start meusaldo-fase2-postgres`; depois iniciar API e frontend.

## Migrações e bancos existentes

- `202610210001_initial`: reproduz o schema original (Receita/Despesa, inicialmente Float).
- `202610210002_decimal`: converte valor para Decimal(12,2), valida os dados e
  adiciona restrição positiva. A transação bloqueia as tabelas durante a conversão.
- `202610210003_usuarios_sessoes`: cria Usuario/Sessao e propriedade obrigatória
  dos lançamentos, com FKs e índices. Recusa transacionalmente qualquer receita
  ou despesa antiga sem dono, sem alterar ou atribuir esses dados.
- Banco novo: `npm run db:migrate` aplica as três.
- Na base local inspecionada havia 0 receitas e 0 despesas antes desta última
  migração. Se outra base tiver registros antigos, interromper e planejar sua
  vinculação com autorização do responsável. Não associar ao primeiro cadastro.
- Banco existente sem histórico: fazer backup e comparar o schema antes de qualquer
  aplicação. Se corresponder exatamente ao schema original, registrar a baseline
  com `npx prisma migrate resolve --applied 202610210001_initial` e então executar
  `npm run db:migrate`. Não marcar baseline em um schema desconhecido.
- Parar os escritores/API ao migrar um banco existente. Dados não finitos, não
  positivos, acima do limite ou com fração de centavo interrompem a migração.
  Não são arredondados nem apagados; revisar e decidir sua regularização antes de tentar novamente.
- Não usar reset, recriação de tabelas, db push ou remoção de volumes para resolver erro.

O teste de migração cria um schema próprio em banco de teste, comprova rollback
de valor incompatível e conversão sem perda de um valor válido, e remove só seu schema.
Também comprova que a migração de usuários preserva e recusa registros antigos,
e cria o proprietário obrigatório quando o schema está vazio.

## Endpoints e contrato

As rotas financeiras exigem sessão válida (401 caso ausente/expirada/revogada).
Todas as consultas, filtros, agregações, atualizações e exclusões restringem o
proprietário obtido da sessão. IDs de outra conta retornam o mesmo 404 de um ID
inexistente. usuarioId/userId do cliente não autorizam nem reatribuem registros.

| Método | Rota | Sucesso |
| --- | --- | --- |
| GET | /receitas, /despesas | 200; arrays ordenados por data e ID decrescentes |
| GET | /receitas/:id, /despesas/:id | 200 |
| POST | /receitas, /despesas | 201 |
| PUT | /receitas/:id, /despesas/:id | 200 |
| DELETE | /receitas/:id, /despesas/:id | 204, sem corpo |
| GET | /saldo | 200 |

GET das listagens aceita `?categoria=` para correspondência exata.
JSON de POST/PUT:

```json
{ "descricao": "Pagamento", "valor": 1250.90, "categoria": "Trabalho", "data": "2026-10-21" }
```

Descrição: 3–100 caracteres; categoria: 1–60; valor numérico finito maior que zero,
até duas casas decimais e máximo 9.999.999.999,99; data real no formato YYYY-MM-DD.
Textos são normalizados com trim. Datas são dias civis em UTC.
Os IDs são inteiros positivos decimais compatíveis com o Int do PostgreSQL.

Registros retornam `id, descricao, valor, categoria, data, criadoEm, usuarioId`.
Valor permanece **number no JSON**, preservando o contrato; no banco é Decimal.
Datas são strings ISO. GET /saldo retorna:

```json
{ "totalReceitas": 1250.90, "totalDespesas": 250.10, "saldo": 1000.80 }
```

A soma/subtração ocorre em Prisma Decimal, com leitura consistente na transação.
Não se usa soma de Float. Valores JSON continuam sujeitos à representação numérica
do JavaScript; não usar esta API acadêmica para operações acima de centavos seguros.

Erros: 400 com `{ erro, campos }` para validação/JSON inválido; 404 com `{ erro }`
para ID inexistente; 500 genérico para falha inesperada, sem detalhes do banco na resposta.
O middleware de atraso de 400 ms nos GETs foi preservado.

## Autenticação e segurança

| Método | Rota | Contrato |
| --- | --- | --- |
| POST | /auth/registro | nome (2–100), e-mail válido/único, senha (12–128 caracteres); 201 com usuário público |
| POST | /auth/login | e-mail e senha; 200 com `{ usuario: { id, nome, email }, expiraEm }` e cookie |
| GET | /auth/me | mesma resposta pública da sessão, ou 401 |
| POST | /auth/logout | revoga a sessão no banco e limpa cookie; 204 |

Cadastro inválido retorna 400 com campos; duplicação normalizada retorna 409.
E-mail recebe trim/lowercase; senha preserva espaços e nunca é retornada/logada.
Argon2id usa salt aleatório, 19456 KiB, 2 iterações e paralelismo 1, conforme
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
`argon2` evita implementar criptografia própria; `express-rate-limit` limita
login a 10 falhas por IP/15 minutos e cadastro a 10/IP/hora (429 com Retry-After).
Falha de login usa a mesma mensagem para senha incorreta e conta inexistente,
incluindo verificação de hash fictício para conta ausente.

Sessões usam token aleatório de 256 bits, validade fixa de uma hora e somente
SHA-256 no banco. Cookie host-only, Path=/, HttpOnly e SameSite=Lax. Em produção,
Secure e prefixo `__Host-`. Novo login troca o token e revoga a sessão anterior
apresentada pelo navegador; outros dispositivos têm sessões independentes.
Logout apaga o hash no banco. Cookies desconhecidos/expirados não autenticam.
Respostas 401 não alteram cookies, evitando apagar um login posterior com um
401 atrasado. Sessões expiradas da própria conta são limpas no próximo login.

Toda mutação exige `X-MeuSaldo-Request: 1`. Se Origin estiver presente deve estar
na allowlist exata; Fetch Metadata cross-site é recusado. CORS permite apenas
origens configuradas e credentials. Esse padrão de custom header/preflight e
origens explícitas segue a orientação de
[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
Erro CSRF é 403. Respostas usam Cache-Control: no-store; JSON é limitado a 16 KiB.
Não há tokens em localStorage, hashes nas respostas ou credenciais em logs.
O Express não confia em X-Forwarded-For (`trust proxy=false`).

## Seed

A inicialização **não insere registros**. Um banco vazio continua vazio e a exclusão
do último registro permanece após reiniciar.

`npm run seed` é opcional: exige SEED_USUARIO_EMAIL de uma conta já cadastrada.
Usa src/seed.ts e preenche somente as listas vazias dessa conta. Não cria contas
nem atribui dados antigos. Não foi executado nesta fase.
Não execute esse comando em um banco que deva permanecer vazio ou em dados reais.

## Testes

```powershell
npm test
npm run build
```

Nove testes unitários cobrem validação financeira/autenticação e Argon2id. Não exigem banco.
O backend não tem script de lint; não há aprovação de lint a declarar.

Para os testes integrados, criar previamente um banco **exclusivo**, com nome
terminado em `_test`, e configurar `.env.test` usando `.env.test.example`.
Nunca apontar para a base de desenvolvimento ou dados reais.

```powershell
if (!(Test-Path .env.test)) { Copy-Item .env.test.example .env.test }
# Ajustar TEST_DATABASE_URL.
npm run test:integration
```

A suite recusa nomes sem sufixo _test, aplica migrações e executa 20 testes:
CRUD autenticado, centavos, migração, autenticação, expiração, revogação, CSRF,
CORS, rate limit, resposta atrasada e isolamento GET/PUT/DELETE entre duas contas.
Limpa somente usuários/lançamentos criados pela suite e seu schema temporário.
Não trunca tabelas nem limpa registros preexistentes.

`requests.http` mantém exemplos manuais da API. O registro completo da validação
das fases está em [FASE2.md](https://github.com/joaozitoito/controle_financeiro/blob/main/docs/FASE2.md)
e [FASE3.md](https://github.com/joaozitoito/controle_financeiro/blob/main/docs/FASE3.md).
Os [ADRs](https://github.com/joaozitoito/controle_financeiro#decisões) são mantidos
no README principal do frontend para evitar cópias divergentes das decisões comuns.

## Organização e limite

src/server.ts inicializa; app.ts registra CORS/middlewares/rotas; prisma.ts compartilha
o cliente; validacao.ts valida entradas; financeiro.ts preserva o contrato JSON;
rotas/ contém CRUD e saldo; seed-cli.ts expõe o seed explícito.
auth/ contém senha, validação, sessão e CSRF. Uso local, sem publicação.
Rate limit em memória vale para uma instância e reinicia com o processo. Distribuição
entre instâncias/proxy e recuperação/validação de e-mail/2FA não foram implementadas.
