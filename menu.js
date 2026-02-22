/**
 * MENU INTERATIVO - Sistema de Ativação
 * Basta rodar: node menu.js
 * Ou dar duplo clique no GERENCIAR-CHAVES.bat
 */

const readline = require('readline');

const SERVIDOR = 'https://ativacao-titulos.onrender.com';
const ADMIN_KEY = 'd11dec54d5b7c4fcfd3d034b211a9f12b0d185f36ef8449b';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function perguntar(texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

async function chamarAPI(metodo, endpoint, dados) {
  const url = SERVIDOR + endpoint;
  const opcoes = {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY
    }
  };
  if (dados) opcoes.body = JSON.stringify(dados);
  const resp = await fetch(url, opcoes);
  return await resp.json();
}

function limpar() {
  console.clear();
}

// ==================== MENU ====================

async function mostrarMenu() {
  limpar();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   SISTEMA DE ATIVAÇÃO - TÍTULOS DE       ║');
  console.log('  ║   CRÉDITO - GERENCIADOR DE CHAVES        ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  [1] Gerar nova chave para comprador');
  console.log('  [2] Listar todas as chaves');
  console.log('  [3] Ver detalhes de uma chave');
  console.log('  [4] Bloquear chave');
  console.log('  [5] Desbloquear chave');
  console.log('  [6] Publicar chaves (deploy no servidor)');
  console.log('  [0] Sair');
  console.log('');

  const opcao = await perguntar('  Digite o número da opção: ');

  switch (opcao.trim()) {
    case '1': await gerarChave(); break;
    case '2': await listarChaves(); break;
    case '3': await verChave(); break;
    case '4': await bloquearChave(); break;
    case '5': await desbloquearChave(); break;
    case '6': await publicarChaves(); break;
    case '0':
      console.log('\n  Até logo!\n');
      rl.close();
      return;
    default:
      console.log('\n  Opção inválida!');
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
    console.log('  Erro: Nome é obrigatório!');
    return;
  }

  const email = await perguntar('  E-mail (opcional, aperte ENTER para pular): ');

  console.log('\n  Gerando chave no servidor...');
  const resultado = await chamarAPI('POST', '/api/admin/gerar', {
    nome: nome.trim(),
    email: email.trim()
  });

  if (resultado.erro) {
    console.log('  ERRO: ' + resultado.erro);
    return;
  }

  // Salvar também no banco LOCAL para persistência no deploy
  try {
    const initSqlJs = require('sql.js');
    const fs = require('fs');
    const path = require('path');
    const DB_PATH = path.join(__dirname, 'servidor', 'chaves.db');
    const SQL = await initSqlJs();
    let db;
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
      db.run("CREATE TABLE IF NOT EXISTS chaves (id INTEGER PRIMARY KEY AUTOINCREMENT, chave TEXT UNIQUE NOT NULL, nome_comprador TEXT NOT NULL, email TEXT, max_dispositivos INTEGER DEFAULT 3, ativa INTEGER DEFAULT 1, criada_em DATETIME DEFAULT (datetime('now','localtime')))");
    }
    db.run('INSERT OR IGNORE INTO chaves (chave, nome_comprador, email, max_dispositivos) VALUES (?, ?, ?, ?)',
      [resultado.chave, nome.trim(), email.trim(), 3]);
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    db.close();
    console.log('  Chave salva no banco local (pronta para deploy).');
  } catch(e) {
    console.log('  Aviso: não salvou localmente (' + e.message + ')');
    console.log('  A chave funciona, mas faça deploy para persistir.');
  }

  console.log('');
  console.log('  ┌────────────────────────────────────────┐');
  console.log('  │  CHAVE GERADA COM SUCESSO!             │');
  console.log('  │                                        │');
  console.log('  │  ' + resultado.chave.padEnd(38) + '│');
  console.log('  │                                        │');
  console.log('  │  Comprador: ' + nome.trim().substring(0, 26).padEnd(26) + '│');
  console.log('  │  Limite: 3 dispositivos                │');
  console.log('  └────────────────────────────────────────┘');
  console.log('');
  console.log('  COPIE A CHAVE ACIMA e envie junto com o');
  console.log('  arquivo HTML para o comprador.');
  console.log('');
  console.log('  IMPORTANTE: Para garantir que a chave');
  console.log('  persista, execute depois:');
  console.log('  cd C:\\Users\\Usuario\\Projetos\\sistema-ativacao');
  console.log('  git add servidor/chaves.db && git commit -m "Nova chave" && git push');
}

async function listarChaves() {
  limpar();
  console.log('\n  === TODAS AS CHAVES ===\n');
  console.log('  Carregando...');

  const resultado = await chamarAPI('GET', '/api/admin/listar');

  if (resultado.erro) {
    console.log('  ERRO: ' + resultado.erro);
    return;
  }

  const chaves = resultado.chaves;
  limpar();

  if (chaves.length === 0) {
    console.log('\n  Nenhuma chave cadastrada ainda.');
    console.log('  Use a opção [1] para gerar uma nova chave.');
    return;
  }

  console.log('\n  === CHAVES CADASTRADAS (' + chaves.length + ') ===\n');
  console.log('  ' + 'CHAVE'.padEnd(24) + 'COMPRADOR'.padEnd(20) + 'DISP.'.padEnd(8) + 'STATUS');
  console.log('  ' + '─'.repeat(65));

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

  console.log('  Buscando...');
  const registro = await chamarAPI('GET', '/api/admin/ver/' + chave.trim().toUpperCase());

  if (registro.erro) {
    console.log('  Chave não encontrada!');
    return;
  }

  const dispositivos = registro.dispositivos || [];

  console.log('');
  console.log('  Chave:        ' + registro.chave);
  console.log('  Comprador:    ' + registro.nome_comprador);
  console.log('  E-mail:       ' + (registro.email || '(não informado)'));
  console.log('  Status:       ' + (registro.ativa ? 'ATIVA' : 'BLOQUEADA'));
  console.log('  Dispositivos: ' + dispositivos.length + '/' + registro.max_dispositivos);
  console.log('  Criada em:    ' + registro.criada_em);

  if (dispositivos.length > 0) {
    console.log('');
    console.log('  DISPOSITIVOS:');
    for (const d of dispositivos) {
      console.log('    - ' + d.nome + ' (ativado: ' + d.ativado_em + ')');
    }
  }
}

async function bloquearChave() {
  limpar();
  console.log('\n  === BLOQUEAR CHAVE ===\n');

  const chave = await perguntar('  Digite a chave para BLOQUEAR: ');
  if (!chave.trim()) return;

  const confirma = await perguntar('  Tem certeza? (s/n): ');
  if (confirma.toLowerCase() !== 's') {
    console.log('  Cancelado.');
    return;
  }

  const resultado = await chamarAPI('POST', '/api/admin/bloquear', { chave: chave.trim().toUpperCase() });

  if (resultado.sucesso) {
    console.log('  Chave BLOQUEADA com sucesso!');
    console.log('  O comprador não conseguirá mais acessar.');
  } else {
    console.log('  Chave não encontrada!');
  }
}

async function desbloquearChave() {
  limpar();
  console.log('\n  === DESBLOQUEAR CHAVE ===\n');

  const chave = await perguntar('  Digite a chave para DESBLOQUEAR: ');
  if (!chave.trim()) return;

  const resultado = await chamarAPI('POST', '/api/admin/desbloquear', { chave: chave.trim().toUpperCase() });

  if (resultado.sucesso) {
    console.log('  Chave DESBLOQUEADA com sucesso!');
  } else {
    console.log('  Chave não encontrada!');
  }
}

async function publicarChaves() {
  limpar();
  console.log('\n  === PUBLICAR CHAVES NO SERVIDOR ===\n');
  console.log('  Isso vai enviar o banco de dados com todas');
  console.log('  as chaves para o servidor (deploy).\n');

  const confirma = await perguntar('  Confirma? (s/n): ');
  if (confirma.toLowerCase() !== 's') {
    console.log('  Cancelado.');
    return;
  }

  console.log('\n  Fazendo commit e push...');

  const { execSync } = require('child_process');
  const dir = __dirname;

  try {
    execSync('git add servidor/chaves.db', { cwd: dir, stdio: 'pipe' });
    execSync('git commit -m "Atualizar chaves de ativacao"', { cwd: dir, stdio: 'pipe' });
    execSync('git push origin master', { cwd: dir, stdio: 'pipe' });
    console.log('');
    console.log('  ┌────────────────────────────────────────┐');
    console.log('  │  PUBLICADO COM SUCESSO!                │');
    console.log('  │                                        │');
    console.log('  │  O servidor será atualizado em ~2 min. │');
    console.log('  │  Todas as chaves estarão disponíveis.  │');
    console.log('  └────────────────────────────────────────┘');
  } catch(e) {
    if (e.message.includes('nothing to commit')) {
      console.log('  Nada para publicar - banco já está atualizado.');
    } else {
      console.log('  ERRO: ' + e.message);
    }
  }
}

// ==================== INICIAR ====================

mostrarMenu().catch(err => {
  console.error('  Erro de conexão: ' + err.message);
  console.error('  Verifique sua internet.');
  rl.close();
});
