const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

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
