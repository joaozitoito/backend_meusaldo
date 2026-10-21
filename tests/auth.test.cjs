const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { iniciar, chamar, criarConta, limpar, prisma } = require('./suporte-auth.cjs');
let base, servidor, a, b;
const usuarios = [];
const payload = { descricao:'Registro privado', valor:10, categoria:'Compartilhada', data:'2026-10-21' };
const tokenHash = cookie => createHash('sha256').update(cookie.split('=')[1]).digest('hex');
before(async () => {
  ({ base, servidor } = await iniciar());
  a = await criarConta(base, usuarios);
  b = await criarConta(base, usuarios);
});
after(() => limpar(servidor, usuarios));

test('todas as rotas financeiras recusam acesso anônimo com 401 e no-store', async () => {
  for (const tipo of ['receitas','despesas']) for (const [method, rota] of [['GET',`/${tipo}`],['POST',`/${tipo}`],['GET',`/${tipo}/1`],['PUT',`/${tipo}/1`],['DELETE',`/${tipo}/1`]]) {
    const r = await chamar(base, rota, { method, dados: ['POST','PUT'].includes(method) ? payload : undefined, csrf:false });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await chamar(base,'/saldo')).status,401);
  assert.equal((await chamar(base,'/auth/me')).status,401);
});

test('cadastro retorna somente dados públicos, normaliza e-mail e armazena Argon2id', async () => {
  const usuario = await prisma.usuario.findUnique({ where:{id:a.id} });
  assert.ok(usuario.senhaHash.startsWith('$argon2id$'));
  assert.ok(usuario.senhaHash !== a.senha);
  const eu = await chamar(base,'/auth/me',{cookie:a.cookie});
  assert.equal(eu.status,200);
  assert.deepEqual(Object.keys(eu.dados.usuario).sort(),['email','id','nome']);
  assert.ok(new Date(eu.dados.expiraEm) > new Date());
});

test('cadastro inválido retorna campos e duplicação normalizada retorna 409', async () => {
  const invalido = await chamar(base,'/auth/registro',{method:'POST',dados:{nome:'a',email:'inválido',senha:'curta'}});
  assert.equal(invalido.status,400);
  assert.deepEqual(Object.keys(invalido.dados.campos).sort(),['email','nome','senha']);
  const repetido = await chamar(base,'/auth/registro',{method:'POST',dados:{nome:'Outra pessoa',email:` ${a.email.toUpperCase()} `,senha:a.senha}});
  assert.equal(repetido.status,409);
});

test('login normalizado, cookie seguro e token armazenado apenas como hash', async () => {
  const r = await chamar(base,'/auth/login',{method:'POST',dados:{email:` ${a.email.toUpperCase()} `,senha:a.senha}});
  assert.equal(r.status,200);
  const cabecalho = r.headers.get('set-cookie');
  assert.ok(cabecalho.includes('HttpOnly') && cabecalho.includes('SameSite=Lax') && cabecalho.includes('Path=/'));
  assert.ok(!cabecalho.includes('Domain='));
  const sessao = await prisma.sessao.findUnique({where:{tokenHash:tokenHash(r.cookie)}});
  assert.equal(sessao.usuarioId,a.id);
  assert.ok(sessao.tokenHash !== r.cookie.split('=')[1]);
  assert.ok(!JSON.stringify(r.dados).includes('senhaHash'));
  assert.ok(!JSON.stringify(r.dados).includes(r.cookie.split('=')[1]));
});

test('senha incorreta e conta inexistente usam a mesma mensagem genérica', async () => {
  const errado = await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:'Senha errada de teste'}});
  const ausente = await chamar(base,'/auth/login',{method:'POST',dados:{email:'ausente@example.test',senha:'Senha errada de teste'}});
  assert.equal(errado.status,401);
  assert.equal(ausente.status,401);
  assert.deepEqual(errado.dados,ausente.dados);
});

test('sessão expirada é recusada; sessão desconhecida não autentica', async () => {
  const login = await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:a.senha}});
  await prisma.sessao.update({where:{tokenHash:tokenHash(login.cookie)},data:{expiraEm:new Date(Date.now()-1000)}});
  assert.equal((await chamar(base,'/auth/me',{cookie:login.cookie})).status,401);
  assert.equal((await chamar(base,'/receitas',{cookie:login.cookie})).status,401);
  assert.equal((await chamar(base,'/auth/me',{cookie:`meusaldo_sessao=${'a'.repeat(64)}`})).status,401);
});

test('401 de consulta antiga não apaga o cookie de um login mais recente', async () => {
  const antiga = chamar(base,'/auth/me');
  const login = await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:a.senha}});
  assert.equal(login.status,200);
  const respostaAntiga = await antiga;
  assert.equal(respostaAntiga.status,401);
  assert.equal(respostaAntiga.headers.get('set-cookie'),null);
  const expirada = await chamar(base,'/auth/me',{cookie:`meusaldo_sessao=${'f'.repeat(64)}`});
  assert.equal(expirada.headers.get('set-cookie'),null);
  assert.equal((await chamar(base,'/auth/me',{cookie:login.cookie})).status,200);
});

test('logout revoga o token no banco e impede seu reuso', async () => {
  const login = await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:a.senha}});
  assert.equal((await chamar(base,'/auth/logout',{method:'POST',cookie:login.cookie})).status,204);
  assert.equal(await prisma.sessao.findUnique({where:{tokenHash:tokenHash(login.cookie)}}),null);
  assert.equal((await chamar(base,'/auth/me',{cookie:login.cookie})).status,401);
});

test('novo login troca token e revoga a sessão anterior desse navegador', async () => {
  const primeiro = await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:a.senha}});
  const segundo = await chamar(base,'/auth/login',{method:'POST',cookie:primeiro.cookie,dados:{email:b.email,senha:b.senha}});
  assert.equal(segundo.status,200);
  assert.ok(primeiro.cookie !== segundo.cookie);
  assert.equal((await chamar(base,'/auth/me',{cookie:primeiro.cookie})).status,401);
  assert.equal((await chamar(base,'/auth/me',{cookie:segundo.cookie})).dados.usuario.id,b.id);
});

test('CSRF recusa mutações sem custom header, Origin inválida e Fetch Metadata cross-site', async () => {
  for (const opcoes of [{csrf:false},{headers:{Origin:'https://atacante.example'}},{headers:{Origin:'null'}},{headers:{'Sec-Fetch-Site':'cross-site'}}]) {
    const r=await chamar(base,'/receitas',{method:'POST',cookie:a.cookie,dados:payload,...opcoes});
    assert.equal(r.status,403);
  }
  const preflight=await fetch(base+'/receitas',{method:'OPTIONS',headers:{Origin:'http://localhost:3000','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-meusaldo-request'}});
  assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:3000');
  assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
});

test('duas contas: isolamento de listas, filtros, GET/PUT/DELETE e saldo; dono forjado é ignorado', async () => {
  const registros={};
  for (const [pessoa,conta] of [['a',a],['b',b]]) for (const tipo of ['receitas','despesas']) {
    const r=await chamar(base,`/${tipo}`,{method:'POST',cookie:conta.cookie,dados:{...payload,valor:pessoa==='a'?(tipo==='receitas'?10:3):(tipo==='receitas'?20:4),usuarioId:pessoa==='a'?b.id:a.id,userId:pessoa==='a'?b.id:a.id}});
    assert.equal(r.status,201);
    registros[pessoa+tipo]=r.dados.id;
  }
  for(const [pessoa,conta,outra] of [['a',a,'b'],['b',b,'a']]) for(const tipo of ['receitas','despesas']) {
    const lista=await chamar(base,`/${tipo}?categoria=Compartilhada&userId=${pessoa==='a'?b.id:a.id}`,{cookie:conta.cookie});
    assert.deepEqual(lista.dados.map(item=>item.id),[registros[pessoa+tipo]]);
    for(const method of ['GET','PUT','DELETE']) assert.equal((await chamar(base,`/${tipo}/${registros[outra+tipo]}`,{method,cookie:conta.cookie,dados:method==='PUT'?payload:undefined})).status,404);
    assert.equal((await chamar(base,`/${tipo}/2147483647`,{cookie:conta.cookie})).status,404);
  }
  assert.deepEqual((await chamar(base,'/saldo',{cookie:a.cookie})).dados,{totalReceitas:10,totalDespesas:3,saldo:7});
  assert.deepEqual((await chamar(base,'/saldo',{cookie:b.cookie})).dados,{totalReceitas:20,totalDespesas:4,saldo:16});
  const mudanca=await chamar(base,`/receitas/${registros.areceitas}`,{method:'PUT',cookie:a.cookie,dados:{...payload,valor:12,usuarioId:b.id}});
  assert.equal(mudanca.status,200);
  assert.equal((await prisma.receita.findUnique({where:{id:registros.areceitas}})).usuarioId,a.id);
  assert.equal((await chamar(base,'/saldo',{cookie:a.cookie})).dados.saldo,9);
  assert.equal((await chamar(base,'/saldo',{cookie:b.cookie})).dados.saldo,16);
});

test('cookie de produção usa Secure e prefixo host; usuário removido não conserva sessão', async () => {
  const anterior=process.env.NODE_ENV;
  try {
    process.env.NODE_ENV='production';
    const r=await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:a.senha}});
    assert.equal(r.status,200);
    assert.ok(r.headers.get('set-cookie').startsWith('__Host-meusaldo_sessao='));
    assert.ok(r.headers.get('set-cookie').includes('Secure'));
  } finally { if(anterior===undefined) delete process.env.NODE_ENV;else process.env.NODE_ENV=anterior; }
  const c=await criarConta(base,usuarios);
  await prisma.usuario.delete({where:{id:c.id}});
  assert.equal((await chamar(base,'/auth/me',{cookie:c.cookie})).status,401);
});

test('tentativas repetidas retornam 429 e não confiam em X-Forwarded-For', async () => {
  let bloqueado=false;
  for(let tentativa=0;tentativa<12;tentativa++) {
    const r=await chamar(base,'/auth/login',{method:'POST',dados:{email:a.email,senha:'Senha incorreta de teste'},headers:{'X-Forwarded-For':`10.0.0.${tentativa+1}`}});
    if(r.status===429){ assert.ok(r.headers.get('retry-after'));bloqueado=true;break; }
    assert.equal(r.status,401);
  }
  assert.equal(bloqueado,true);
});
