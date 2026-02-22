/**
 * MENU INTERATIVO - Sistema de Ativação
 * Basta rodar: node menu.js
 * Ou dar duplo clique no GERENCIAR-CHAVES.bat
 *
 * Todas as operações são feitas no banco local.
 * A publicação no servidor é AUTOMÁTICA após gerar/bloquear/desbloquear.
 */

const readline = require('readline');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, 'servidor', 'chaves.db');

let db;
let SQL;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function perguntar(texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

function limpar() {
  console.clear();
}

// ==================== BANCO DE DADOS LOCAL ====================

async function abrirBanco() {
  if (db) return;
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS chaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    nome_comprador TEXT NOT NULL,
    email TEXT,
    max_dispositivos INTEGER DEFAULT 3,
    ativa INTEGER DEFAULT 1,
    criada_em DATETIME DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS dispositivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave_id INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    nome TEXT,
    token TEXT UNIQUE NOT NULL,
    ativado_em DATETIME DEFAULT (datetime('now','localtime')),
    ultimo_acesso DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (chave_id) REFERENCES chaves(id),
    UNIQUE(chave_id, fingerprint)
  )`);
  salvarBanco();
}

function salvarBanco() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const resultados = [];
  while (stmt.step()) resultados.push(stmt.getAsObject());
  stmt.free();
  return resultados;
}

function queryOne(sql, params) {
  const resultados = queryAll(sql, params);
  return resultados.length > 0 ? resultados[0] : null;
}

function gerarCodigoChave() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bloco = () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[crypto.randomInt(chars.length)];
    return s;
  };
  return 'TC-2026-' + bloco() + '-' + bloco() + '-' + bloco();
}

// ==================== PUBLICAÇÃO AUTOMÁTICA ====================

function publicarAutomatico(mensagem) {
  const dir = __dirname;
  try {
    execSync('git add servidor/chaves.db', { cwd: dir, stdio: 'pipe' });
    try {
      execSync('git commit -m "' + mensagem + '"', { cwd: dir, stdio: 'pipe' });
    } catch(e) {
      if (e.stderr && e.stderr.toString().includes('nothing to commit')) {
        return true; // já está atualizado
      }
      throw e;
    }
    execSync('git push origin master', { cwd: dir, stdio: 'pipe', timeout: 30000 });
    return true;
  } catch(e) {
    console.log('');
    console.log('  AVISO: Nao foi possivel publicar automaticamente.');
    console.log('  Erro: ' + (e.stderr ? e.stderr.toString().substring(0, 150) : e.message));
    console.log('  Use opcao [6] para tentar manualmente.');
    return false;
  }
}

// ==================== MENU ====================

async function mostrarMenu() {
  limpar();
  console.log('');
  console.log('  +============================================+');
  console.log('  |   SISTEMA DE ATIVACAO - TITULOS DE          |');
  console.log('  |   CREDITO - GERENCIADOR DE CHAVES           |');
  console.log('  +============================================+');
  console.log('');
  console.log('  [1] Gerar nova chave para comprador');
  console.log('  [2] Listar todas as chaves');
  console.log('  [3] Ver detalhes de uma chave');
  console.log('  [4] Bloquear chave');
  console.log('  [5] Desbloquear chave');
  console.log('  [6] Publicar chaves manualmente (se falhou)');
  console.log('  [0] Sair');
  console.log('');

  const opcao = await perguntar('  Digite o numero da opcao: ');

  switch (opcao.trim()) {
    case '1': await gerarChave(); break;
    case '2': await listarChaves(); break;
    case '3': await verChave(); break;
    case '4': await bloquearChave(); break;
    case '5': await desbloquearChave(); break;
    case '6': await publicarChaves(); break;
    case '0':
      console.log('\n  Ate logo!\n');
      rl.close();
      return;
    default:
      console.log('\n  Opcao invalida!');
  }

  await perguntar('\n  Pressione ENTER para voltar ao menu...');
  await mostrarMenu();
}

// ==================== FUNÇÕES ====================

async function gerarChave() {
  limpar();
  console.log('\n  === GERAR NOVA CHAVE ===\n');

  const nome = await perguntar('  Nome do comprador: ');
  if (!nome.trim()) {
    console.log('  Erro: Nome e obrigatorio!');
    return;
  }

  const email = await perguntar('  E-mail (opcional, aperte ENTER para pular): ');

  // Gerar chave única
  let chave;
  do {
    chave = gerarCodigoChave();
  } while (queryOne('SELECT 1 FROM chaves WHERE chave = ?', [chave]));

  db.run('INSERT INTO chaves (chave, nome_comprador, email, max_dispositivos) VALUES (?, ?, ?, ?)',
    [chave, nome.trim(), email.trim() || '', 3]);
  salvarBanco();

  console.log('');
  console.log('  +----------------------------------------+');
  console.log('  |  CHAVE GERADA COM SUCESSO!             |');
  console.log('  |                                        |');
  console.log('  |  ' + chave.padEnd(38) + '|');
  console.log('  |                                        |');
  console.log('  |  Comprador: ' + nome.trim().substring(0, 26).padEnd(26) + '|');
  console.log('  |  Limite: 3 dispositivos                |');
  console.log('  +----------------------------------------+');

  // PUBLICAR AUTOMATICAMENTE
  console.log('');
  console.log('  Publicando no servidor...');
  const ok = publicarAutomatico('Chave gerada: ' + nome.trim());

  if (ok) {
    console.log('');
    console.log('  +----------------------------------------+');
    console.log('  |  PUBLICADO NO SERVIDOR!                 |');
    console.log('  |                                        |');
    console.log('  |  IMPORTANTE: Aguarde 2-3 minutos       |');
    console.log('  |  antes de enviar a chave ao comprador. |');
    console.log('  |  O servidor precisa desse tempo para   |');
    console.log('  |  atualizar.                            |');
    console.log('  +----------------------------------------+');
  }

  console.log('');
  console.log('  COPIE A CHAVE e envie junto com o');
  console.log('  arquivo TITULOS-CREDITO-PROTEGIDO.html');
}

async function listarChaves() {
  limpar();
  const chaves = queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM dispositivos d WHERE d.chave_id = c.id) as dispositivos_ativos
    FROM chaves c ORDER BY c.criada_em DESC
  `);

  if (chaves.length === 0) {
    console.log('\n  Nenhuma chave cadastrada ainda.');
    console.log('  Use a opcao [1] para gerar uma nova chave.');
    return;
  }

  console.log('\n  === CHAVES CADASTRADAS (' + chaves.length + ') ===\n');
  console.log('  ' + 'CHAVE'.padEnd(24) + 'COMPRADOR'.padEnd(20) + 'DISP.'.padEnd(8) + 'STATUS');
  console.log('  ' + '-'.repeat(65));

  for (const c of chaves) {
    const status = c.ativa ? 'ATIVA' : 'BLOQUEADA';
    const disp = c.dispositivos_ativos + '/' + c.max_dispositivos;
    console.log(
      '  ' +
      c.chave.padEnd(24) +
      c.nome_comprador.substring(0, 18).padEnd(20) +
      disp.padEnd(8) +
      status
    );
  }
}

async function verChave() {
  limpar();
  console.log('\n  === DETALHES DA CHAVE ===\n');

  const chave = await perguntar('  Digite a chave: ');
  if (!chave.trim()) return;

  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave.trim().toUpperCase()]);

  if (!registro) {
    console.log('  Chave nao encontrada!');
    return;
  }

  const dispositivos = queryAll(
    'SELECT * FROM dispositivos WHERE chave_id = ? ORDER BY ativado_em DESC',
    [registro.id]
  );

  console.log('');
  console.log('  Chave:        ' + registro.chave);
  console.log('  Comprador:    ' + registro.nome_comprador);
  console.log('  E-mail:       ' + (registro.email || '(nao informado)'));
  console.log('  Status:       ' + (registro.ativa ? 'ATIVA' : 'BLOQUEADA'));
  console.log('  Dispositivos: ' + dispositivos.length + '/' + registro.max_dispositivos);
  console.log('  Criada em:    ' + registro.criada_em);

  if (dispositivos.length > 0) {
    console.log('');
    console.log('  DISPOSITIVOS:');
    for (const d of dispositivos) {
      console.log('    - ' + (d.nome || 'Desconhecido') + ' (ativado: ' + d.ativado_em + ')');
    }
  }
}

async function bloquearChave() {
  limpar();
  console.log('\n  === BLOQUEAR CHAVE ===\n');

  const chave = await perguntar('  Digite a chave para BLOQUEAR: ');
  if (!chave.trim()) return;

  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave.trim().toUpperCase()]);
  if (!registro) {
    console.log('  Chave nao encontrada!');
    return;
  }

  const confirma = await perguntar('  Bloquear chave de "' + registro.nome_comprador + '"? (s/n): ');
  if (confirma.toLowerCase() !== 's') {
    console.log('  Cancelado.');
    return;
  }

  db.run('UPDATE chaves SET ativa = 0 WHERE chave = ?', [chave.trim().toUpperCase()]);
  salvarBanco();
  console.log('  Chave BLOQUEADA com sucesso!');

  console.log('  Publicando no servidor...');
  const ok = publicarAutomatico('Bloquear chave: ' + registro.nome_comprador);
  if (ok) {
    console.log('  Servidor sera atualizado em ~2 minutos.');
  }
}

async function desbloquearChave() {
  limpar();
  console.log('\n  === DESBLOQUEAR CHAVE ===\n');

  const chave = await perguntar('  Digite a chave para DESBLOQUEAR: ');
  if (!chave.trim()) return;

  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave.trim().toUpperCase()]);
  if (!registro) {
    console.log('  Chave nao encontrada!');
    return;
  }

  db.run('UPDATE chaves SET ativa = 1 WHERE chave = ?', [chave.trim().toUpperCase()]);
  salvarBanco();
  console.log('  Chave DESBLOQUEADA com sucesso!');

  console.log('  Publicando no servidor...');
  const ok = publicarAutomatico('Desbloquear chave: ' + registro.nome_comprador);
  if (ok) {
    console.log('  Servidor sera atualizado em ~2 minutos.');
  }
}

async function publicarChaves() {
  limpar();
  console.log('\n  === PUBLICAR CHAVES NO SERVIDOR ===\n');

  const chaves = queryAll('SELECT chave, nome_comprador, ativa FROM chaves ORDER BY id');
  console.log('  Chaves que serao publicadas:');
  for (const c of chaves) {
    console.log('    ' + (c.ativa ? '[ATIVA]    ' : '[BLOQUEADA]') + ' ' + c.chave + ' - ' + c.nome_comprador);
  }
  console.log('');

  const confirma = await perguntar('  Publicar no servidor? (s/n): ');
  if (confirma.toLowerCase() !== 's') {
    console.log('  Cancelado.');
    return;
  }

  console.log('\n  Enviando para o servidor...');
  const ok = publicarAutomatico('Atualizar chaves de ativacao');

  if (ok) {
    console.log('');
    console.log('  +----------------------------------------+');
    console.log('  |  PUBLICADO COM SUCESSO!                 |');
    console.log('  |                                        |');
    console.log('  |  O servidor sera atualizado em ~2 min. |');
    console.log('  |  Todas as chaves estarao disponiveis.  |');
    console.log('  +----------------------------------------+');
  }
}

// ==================== INICIAR ====================

(async () => {
  await abrirBanco();
  await mostrarMenu();
})().catch(err => {
  console.error('  Erro: ' + err.message);
  rl.close();
});
