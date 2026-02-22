const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'chaves.db');

let db;
let SQL;

async function conectar() {
  if (db) return db;

  SQL = await initSqlJs();

  // SEMPRE carregar o banco commitado como base (contém as chaves pré-geradas)
  // No Render (free tier), o filesystem é efêmero, mas o arquivo deployado persiste
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('Banco carregado de ' + DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('Banco novo criado (sem arquivo base)');
  }

  criarTabelas();
  return db;
}

function salvar() {
  if (!db) return;
  // Tentar salvar no disco (funciona local, pode falhar no Render)
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    // No Render free tier, a escrita pode falhar em alguns cenários
    // O banco continua funcionando em memória
    console.log('Aviso: não foi possível salvar no disco (normal no Render)');
  }
}

function criarTabelas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS chaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT UNIQUE NOT NULL,
      nome_comprador TEXT NOT NULL,
      email TEXT,
      max_dispositivos INTEGER DEFAULT 3,
      ativa INTEGER DEFAULT 1,
      criada_em DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dispositivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_id INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      nome TEXT,
      token TEXT UNIQUE NOT NULL,
      ativado_em DATETIME DEFAULT (datetime('now', 'localtime')),
      ultimo_acesso DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (chave_id) REFERENCES chaves(id),
      UNIQUE(chave_id, fingerprint)
    )
  `);

  salvar();
}

// Helper: executar SELECT e retornar array de objetos
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const resultados = [];
  while (stmt.step()) {
    resultados.push(stmt.getAsObject());
  }
  stmt.free();
  return resultados;
}

// Helper: executar SELECT e retornar primeiro resultado
function queryOne(sql, params = []) {
  const resultados = queryAll(sql, params);
  return resultados.length > 0 ? resultados[0] : null;
}

// Helper: executar INSERT/UPDATE/DELETE
function execute(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  salvar();
  return { changes };
}

// ==================== CHAVES ====================

function gerarCodigoChave() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1 para evitar confusão
  const bloco = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += chars[crypto.randomInt(chars.length)];
    }
    return s;
  };
  return `TC-2026-${bloco()}-${bloco()}-${bloco()}`;
}

function criarChave(nomeComprador, email, maxDispositivos = 3) {
  let chave;
  // Garantir chave única
  do {
    chave = gerarCodigoChave();
  } while (queryOne('SELECT 1 FROM chaves WHERE chave = ?', [chave]));

  execute(
    'INSERT INTO chaves (chave, nome_comprador, email, max_dispositivos) VALUES (?, ?, ?, ?)',
    [chave, nomeComprador, email || '', maxDispositivos]
  );

  return chave;
}

function buscarChave(chave) {
  return queryOne('SELECT * FROM chaves WHERE chave = ?', [chave]);
}

function listarChaves() {
  return queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM dispositivos d WHERE d.chave_id = c.id) as dispositivos_ativos
    FROM chaves c
    ORDER BY c.criada_em DESC
  `);
}

function alterarStatusChave(chave, ativa) {
  const result = execute('UPDATE chaves SET ativa = ? WHERE chave = ?', [ativa ? 1 : 0, chave]);
  return result.changes > 0;
}

// ==================== DISPOSITIVOS ====================

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function ativarDispositivo(chave, fingerprint, nomeDispositivo) {
  // Buscar chave
  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave]);
  if (!registro) {
    return { sucesso: false, erro: 'Chave não encontrada' };
  }
  if (!registro.ativa) {
    return { sucesso: false, erro: 'Chave bloqueada. Entre em contato com o suporte.' };
  }

  // Verificar se dispositivo já está registrado
  const dispositivoExistente = queryOne(
    'SELECT * FROM dispositivos WHERE chave_id = ? AND fingerprint = ?',
    [registro.id, fingerprint]
  );

  if (dispositivoExistente) {
    // Atualizar último acesso e retornar token existente
    execute(
      'UPDATE dispositivos SET ultimo_acesso = datetime("now", "localtime"), nome = ? WHERE id = ?',
      [nomeDispositivo || dispositivoExistente.nome, dispositivoExistente.id]
    );
    return { sucesso: true, token: dispositivoExistente.token };
  }

  // Verificar limite de dispositivos
  const contagem = queryOne(
    'SELECT COUNT(*) as total FROM dispositivos WHERE chave_id = ?',
    [registro.id]
  );
  const totalDispositivos = contagem ? contagem.total : 0;

  if (totalDispositivos >= registro.max_dispositivos) {
    return {
      sucesso: false,
      erro: `Limite de ${registro.max_dispositivos} dispositivos atingido. Desative um dispositivo para ativar outro.`
    };
  }

  // Registrar novo dispositivo
  const token = gerarToken();
  execute(
    'INSERT INTO dispositivos (chave_id, fingerprint, nome, token) VALUES (?, ?, ?, ?)',
    [registro.id, fingerprint, nomeDispositivo || 'Desconhecido', token]
  );

  return { sucesso: true, token };
}

function verificarToken(token, fingerprint) {
  const dispositivo = queryOne(`
    SELECT d.*, c.ativa
    FROM dispositivos d
    JOIN chaves c ON c.id = d.chave_id
    WHERE d.token = ? AND d.fingerprint = ?
  `, [token, fingerprint]);

  if (!dispositivo) {
    return { valido: false };
  }

  if (!dispositivo.ativa) {
    return { valido: false, erro: 'Chave bloqueada' };
  }

  // Atualizar último acesso
  execute(
    'UPDATE dispositivos SET ultimo_acesso = datetime("now", "localtime") WHERE id = ?',
    [dispositivo.id]
  );

  return { valido: true };
}

function desativarDispositivo(chave, fingerprint) {
  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave]);
  if (!registro) {
    return { sucesso: false, erro: 'Chave não encontrada' };
  }

  const result = execute(
    'DELETE FROM dispositivos WHERE chave_id = ? AND fingerprint = ?',
    [registro.id, fingerprint]
  );

  if (result.changes === 0) {
    return { sucesso: false, erro: 'Dispositivo não encontrado' };
  }

  return { sucesso: true };
}

function listarDispositivos(chave) {
  const registro = queryOne('SELECT * FROM chaves WHERE chave = ?', [chave]);
  if (!registro) return [];

  return queryAll(
    'SELECT * FROM dispositivos WHERE chave_id = ? ORDER BY ativado_em DESC',
    [registro.id]
  );
}

module.exports = {
  conectar,
  criarChave,
  buscarChave,
  listarChaves,
  alterarStatusChave,
  ativarDispositivo,
  verificarToken,
  desativarDispositivo,
  listarDispositivos
};
