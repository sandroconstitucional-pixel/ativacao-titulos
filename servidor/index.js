const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'd11dec54d5b7c4fcfd3d034b211a9f12b0d185f36ef8449b';

// Middlewares
app.use(cors());
app.use(express.json());

// Middleware de autenticação admin
function verificarAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  next();
}

// ==================== ENDPOINTS ====================

// POST /api/ativar — Ativa uma chave em um dispositivo
app.post('/api/ativar', (req, res) => {
  try {
    const { chave, fingerprint, nomeDispositivo } = req.body;

    if (!chave || !fingerprint) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Chave e fingerprint são obrigatórios'
      });
    }

    const resultado = db.ativarDispositivo(chave.trim().toUpperCase(), fingerprint, nomeDispositivo);
    const status = resultado.sucesso ? 200 : 403;
    res.status(status).json(resultado);
  } catch (err) {
    console.error('Erro em /api/ativar:', err.message);
    res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor' });
  }
});

// POST /api/verificar — Verifica se um token ainda é válido
app.post('/api/verificar', (req, res) => {
  try {
    const { token, fingerprint } = req.body;

    if (!token || !fingerprint) {
      return res.status(400).json({ valido: false, erro: 'Token e fingerprint são obrigatórios' });
    }

    const resultado = db.verificarToken(token, fingerprint);
    res.json(resultado);
  } catch (err) {
    console.error('Erro em /api/verificar:', err.message);
    res.status(500).json({ valido: false, erro: 'Erro interno do servidor' });
  }
});

// POST /api/desativar — Remove um dispositivo de uma chave
app.post('/api/desativar', (req, res) => {
  try {
    const { chave, fingerprint } = req.body;

    if (!chave || !fingerprint) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Chave e fingerprint são obrigatórios'
      });
    }

    const resultado = db.desativarDispositivo(chave.trim().toUpperCase(), fingerprint);
    res.json(resultado);
  } catch (err) {
    console.error('Erro em /api/desativar:', err.message);
    res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor' });
  }
});

// GET /api/status — Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// ==================== ENDPOINTS ADMIN ====================

// POST /api/admin/gerar — Gera nova chave
app.post('/api/admin/gerar', verificarAdmin, (req, res) => {
  try {
    const { nome, email, maxDispositivos } = req.body;
    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    const chave = db.criarChave(nome, email, maxDispositivos || 3);
    res.json({ sucesso: true, chave });
  } catch (err) {
    console.error('Erro em /api/admin/gerar:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/admin/listar — Lista todas as chaves
app.get('/api/admin/listar', verificarAdmin, (req, res) => {
  try {
    const chaves = db.listarChaves();
    res.json({ chaves });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/admin/ver/:chave — Detalhes de uma chave
app.get('/api/admin/ver/:chave', verificarAdmin, (req, res) => {
  try {
    const registro = db.buscarChave(req.params.chave.toUpperCase());
    if (!registro) return res.status(404).json({ erro: 'Chave não encontrada' });
    const dispositivos = db.listarDispositivos(req.params.chave.toUpperCase());
    res.json({ ...registro, dispositivos });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/admin/bloquear — Bloqueia uma chave
app.post('/api/admin/bloquear', verificarAdmin, (req, res) => {
  try {
    const { chave } = req.body;
    const sucesso = db.alterarStatusChave(chave.toUpperCase(), false);
    res.json({ sucesso });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/admin/desbloquear — Desbloqueia uma chave
app.post('/api/admin/desbloquear', verificarAdmin, (req, res) => {
  try {
    const { chave } = req.body;
    const sucesso = db.alterarStatusChave(chave.toUpperCase(), true);
    res.json({ sucesso });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ==================== INICIAR ====================

async function iniciar() {
  await db.conectar();
  console.log('Banco de dados conectado.');

  app.listen(PORT, () => {
    console.log(`Servidor de ativação rodando na porta ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
  });
}

iniciar().catch(err => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
