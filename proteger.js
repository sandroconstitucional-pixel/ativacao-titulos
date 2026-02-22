/**
 * PROTEGER.JS — Gera versão protegida do HTML de Títulos de Crédito
 *
 * Uso: node proteger.js
 *
 * Pega o HTML original e gera uma versão com:
 * - Tela de ativação (pede chave)
 * - Conteúdo criptografado (base64 + XOR)
 * - Verificação online com o servidor
 * - Tolerância offline de 30 dias
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== CONFIGURAÇÕES ====================

const HTML_ORIGINAL = path.join(
  'C:', 'Users', 'Usuario', 'Documents', 'ESTUDOS', '2026',
  '07 - DIREITO EMPRESARIAL', 'TITULO DE CREDITO',
  'TITULOS-CREDITO-SISTEMA-ESTUDO.html'
);

const HTML_SAIDA = path.join(
  'C:', 'Users', 'Usuario', 'Documents', 'ESTUDOS', '2026',
  '07 - DIREITO EMPRESARIAL', 'TITULO DE CREDITO',
  'TITULOS-CREDITO-PROTEGIDO.html'
);

// URL do servidor — alterar quando fizer deploy no Render
// Para teste local, use: 'http://localhost:3001'
// Para produção, use a URL do Render: 'https://ativacao-titulos.onrender.com'
const SERVIDOR_URL = process.env.SERVIDOR_URL || 'https://ativacao-titulos.onrender.com';

// Chave de ofuscação (usada para XOR do conteúdo)
const CHAVE_OFUSCACAO = crypto.randomBytes(16).toString('hex');

// ==================== FUNÇÕES ====================

function xorCodificar(texto, chave) {
  let resultado = '';
  for (let i = 0; i < texto.length; i++) {
    resultado += String.fromCharCode(
      texto.charCodeAt(i) ^ chave.charCodeAt(i % chave.length)
    );
  }
  return resultado;
}

function gerarTelaAtivacao() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Títulos de Crédito — Sistema de Estudo</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0f172a;--card:#1e293b;--card2:#334155;--text:#e2e8f0;--text2:#94a3b8;--blue:#3b82f6;--green:#22c55e;--red:#ef4444;--amber:#f59e0b;--radius:12px;--shadow:0 4px 6px rgba(0,0,0,.3)}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column}

/* Tela de ativação */
#tela-ativacao{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100vh;padding:20px;
}
.ativacao-box{
  background:var(--card);border-radius:16px;padding:40px;max-width:480px;width:100%;
  box-shadow:0 20px 60px rgba(0,0,0,.5);border:1px solid var(--card2);text-align:center;
}
.ativacao-box h1{font-size:1.4rem;margin-bottom:8px;color:#fff}
.ativacao-box .subtitulo{color:var(--text2);font-size:.85rem;margin-bottom:30px}
.ativacao-box .icone{font-size:3rem;margin-bottom:16px}
.campo-chave{
  width:100%;padding:14px 18px;border-radius:var(--radius);border:2px solid var(--card2);
  background:var(--bg);color:var(--text);font-size:1.1rem;text-align:center;
  font-family:monospace;letter-spacing:2px;outline:none;transition:border .3s;
  text-transform:uppercase;
}
.campo-chave:focus{border-color:var(--blue)}
.campo-chave::placeholder{text-transform:none;letter-spacing:0;font-size:.85rem;color:var(--text2)}
.btn-ativar{
  width:100%;padding:14px;border:none;border-radius:var(--radius);
  background:linear-gradient(135deg,var(--blue),#2563eb);color:#fff;
  font-size:1rem;font-weight:700;cursor:pointer;margin-top:16px;
  transition:all .3s;
}
.btn-ativar:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,130,246,.4)}
.btn-ativar:disabled{opacity:.5;cursor:wait;transform:none}
.msg-erro{color:var(--red);font-size:.85rem;margin-top:12px;display:none}
.msg-sucesso{color:var(--green);font-size:.85rem;margin-top:12px;display:none}
.info-limite{color:var(--text2);font-size:.75rem;margin-top:20px;line-height:1.6}
.spinner{display:inline-block;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}

/* Container do conteúdo (oculto até ativar) */
#conteudo-protegido{display:none}

/* Loading */
.loading-msg{color:var(--text2);font-size:.9rem;margin-top:16px}
</style>
</head>
<body>

<!-- TELA DE ATIVAÇÃO -->
<div id="tela-ativacao">
  <div class="ativacao-box">
    <div class="icone">🔐</div>
    <h1>Sistema de Estudo</h1>
    <p class="subtitulo">Títulos de Crédito — Direito Empresarial</p>

    <input type="text" id="campo-chave" class="campo-chave"
      placeholder="Digite sua chave de ativação"
      maxlength="24" autocomplete="off" spellcheck="false">

    <button id="btn-ativar" class="btn-ativar" onclick="ativar()">
      Ativar Acesso
    </button>

    <div id="msg-erro" class="msg-erro"></div>
    <div id="msg-sucesso" class="msg-sucesso"></div>

    <p class="info-limite">
      Cada chave permite ativação em até 3 dispositivos.<br>
      Sua ativação fica vinculada a este navegador/aparelho.
    </p>
  </div>
</div>

<!-- CONTEÚDO PROTEGIDO (inserido pelo script) -->
<div id="conteudo-protegido"></div>

<!-- DADOS CRIPTOGRAFADOS -->
<script id="dados-protegidos" type="application/octet-stream">%%CONTEUDO_CODIFICADO%%</script>

<script>
// ==================== CONFIGURAÇÃO ====================
const SERVIDOR = '%%SERVIDOR_URL%%';
const CHAVE_XOR = '%%CHAVE_OFUSCACAO%%';
const TOLERANCIA_OFFLINE_DIAS = 30;
const STORAGE_KEY = 'tc_ativacao';

// ==================== DETECÇÃO iOS/MOBILE ====================
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = /Mobile|Android/.test(navigator.userAgent) || isIOS;
const TIMEOUT_PADRAO = (isMobile || isIOS) ? 45000 : 15000;
const TIMEOUT_RETRY = 60000;

// ==================== STORAGE SEGURO (fallback sessionStorage) ====================
const storage = (function() {
  let _store = null;
  try { localStorage.setItem('__test__','1'); localStorage.removeItem('__test__'); _store = localStorage; }
  catch(e) {
    try { sessionStorage.setItem('__test__','1'); sessionStorage.removeItem('__test__'); _store = sessionStorage; }
    catch(e2) { _store = null; }
  }
  return {
    getItem: function(k) { try { return _store ? _store.getItem(k) : null; } catch(e) { return null; } },
    setItem: function(k,v) { try { if (_store) _store.setItem(k,v); } catch(e) {} },
    removeItem: function(k) { try { if (_store) _store.removeItem(k); } catch(e) {} },
    disponivel: function() { return _store !== null; }
  };
})();

// ==================== FINGERPRINT ====================
function gerarFingerprint() {
  const dados = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency || 'x',
    navigator.platform || 'x'
  ];
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) dados.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); }
  } catch(e) {}
  const str = dados.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); hash = ((hash << 5) - hash) + c; hash = hash & hash; }
  return 'fp_' + Math.abs(hash).toString(36) + '_' + str.length.toString(36);
}

function nomeDispositivo() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'Safari iPhone';
  if (/iPad/.test(ua)) return 'Safari iPad';
  if (/Android.*Mobile/.test(ua)) return 'Chrome Android';
  if (/Android/.test(ua)) return 'Chrome Android Tablet';
  if (/Windows/.test(ua)) return 'Chrome Windows';
  if (/Mac/.test(ua)) return 'Safari Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Navegador';
}

// ==================== DECODIFICAÇÃO ====================
function xorDecodificar(texto, chave) {
  let resultado = '';
  for (let i = 0; i < texto.length; i++) {
    resultado += String.fromCharCode(texto.charCodeAt(i) ^ chave.charCodeAt(i % chave.length));
  }
  return resultado;
}

function decodificarConteudo() {
  const dadosEl = document.getElementById('dados-protegidos');
  const base64 = dadosEl.textContent.trim();
  const binario = atob(base64);
  const decodificado = xorDecodificar(binario, CHAVE_XOR);
  return decodeURIComponent(escape(decodificado));
}

function mostrarConteudo() {
  try {
    const html = decodificarConteudo();
    const container = document.getElementById('conteudo-protegido');
    container.innerHTML = html;
    container.style.display = 'block';
    document.getElementById('tela-ativacao').style.display = 'none';
    container.querySelectorAll('script').forEach(script => {
      const novoScript = document.createElement('script');
      novoScript.textContent = script.textContent;
      document.body.appendChild(novoScript);
      script.remove();
    });
  } catch(e) {
    console.error('Erro ao decodificar:', e);
    mostrarErroComRetry('Erro ao carregar conteúdo. Tente novamente.', 'verificar');
  }
}

// ==================== ARMAZENAMENTO ====================
function salvarAtivacao(token) {
  const dados = { token: token, fingerprint: gerarFingerprint(), ativadoEm: new Date().toISOString(), ultimaVerificacao: new Date().toISOString() };
  storage.setItem(STORAGE_KEY, JSON.stringify(dados));
}
function carregarAtivacao() { try { const d = storage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : null; } catch(e) { return null; } }
function limparAtivacao() { storage.removeItem(STORAGE_KEY); }

// ==================== COMUNICAÇÃO COM SERVIDOR (auto-retry) ====================
async function chamarAPIComTimeout(endpoint, dados, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(SERVIDOR + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados), signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    return await resp.json();
  } catch(e) { clearTimeout(timer); throw e; }
}

async function chamarAPI(endpoint, dados) {
  try {
    return await chamarAPIComTimeout(endpoint, dados, TIMEOUT_PADRAO);
  } catch(e) {
    if (e.name === 'AbortError') {
      console.log('Timeout na 1a tentativa, tentando novamente com timeout maior...');
      return await chamarAPIComTimeout(endpoint, dados, TIMEOUT_RETRY);
    }
    throw e;
  }
}

// ==================== ATIVAÇÃO ====================
async function ativar() {
  const campoChave = document.getElementById('campo-chave');
  const chave = campoChave.value.trim().toUpperCase();
  const btnAtivar = document.getElementById('btn-ativar');
  const msgErro = document.getElementById('msg-erro');
  const msgSucesso = document.getElementById('msg-sucesso');
  if (!chave) { mostrarErro('Digite sua chave de ativação.'); return; }
  const chaveFormatada = chave.replace(/[^A-Z0-9]/g, '');
  if (chaveFormatada.length < 16) { mostrarErro('Chave inválida. Verifique e tente novamente.'); return; }
  btnAtivar.disabled = true;
  btnAtivar.innerHTML = '<span class="spinner"></span>' + (isMobile ? 'Verificando (pode demorar)...' : 'Verificando...');
  msgErro.style.display = 'none';
  msgSucesso.style.display = 'none';
  try {
    const resultado = await chamarAPI('/api/ativar', { chave: chave, fingerprint: gerarFingerprint(), nomeDispositivo: nomeDispositivo() });
    if (resultado.sucesso) {
      salvarAtivacao(resultado.token);
      msgSucesso.textContent = 'Ativação bem-sucedida! Carregando conteúdo...';
      msgSucesso.style.display = 'block';
      setTimeout(mostrarConteudo, 800);
    } else {
      mostrarErro(resultado.erro || 'Chave inválida.');
      btnAtivar.disabled = false;
      btnAtivar.textContent = 'Ativar Acesso';
    }
  } catch(e) {
    let msg = isIOS ? 'No iPhone/iPad, o servidor pode demorar para responder na primeira vez. Verifique sua internet e tente novamente.' :
              isMobile ? 'O servidor pode demorar para responder. Verifique sua internet e tente novamente.' :
              'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    mostrarErroComRetry(msg, 'ativar');
    btnAtivar.disabled = false;
    btnAtivar.textContent = 'Ativar Acesso';
  }
}

function mostrarErro(msg) { const el = document.getElementById('msg-erro'); el.textContent = msg; el.style.display = 'block'; }

function mostrarErroComRetry(msg, tipo) {
  const el = document.getElementById('msg-erro');
  el.innerHTML = msg + '<br><button onclick="' + (tipo === 'ativar' ? 'ativar()' : 'verificarAoAbrir()') + '" style="margin-top:10px;padding:8px 20px;border:none;border-radius:8px;background:var(--blue);color:#fff;cursor:pointer;font-weight:700;">Tentar Novamente</button>';
  el.style.display = 'block';
}

// ==================== VERIFICAÇÃO AO ABRIR ====================
async function verificarAoAbrir() {
  if (isIOS && !storage.disponivel()) {
    mostrarErro('No iPhone, abra fora da navegação privada para manter sua ativação salva.');
    return;
  }
  const ativacao = carregarAtivacao();
  if (!ativacao || !ativacao.token) return;
  const fingerprint = gerarFingerprint();
  try {
    const resultado = await chamarAPI('/api/verificar', { token: ativacao.token, fingerprint: fingerprint });
    if (resultado.valido) {
      ativacao.ultimaVerificacao = new Date().toISOString();
      ativacao.fingerprint = fingerprint;
      storage.setItem(STORAGE_KEY, JSON.stringify(ativacao));
      mostrarConteudo();
    } else { limparAtivacao(); }
  } catch(e) {
    const ultimaVerificacao = new Date(ativacao.ultimaVerificacao);
    const diasSemVerificar = (new Date() - ultimaVerificacao) / (1000 * 60 * 60 * 24);
    if (diasSemVerificar <= TOLERANCIA_OFFLINE_DIAS) {
      console.log('Acesso offline permitido (' + Math.floor(diasSemVerificar) + ' dias sem verificar)');
      mostrarConteudo();
    } else {
      limparAtivacao();
      mostrarErroComRetry('Sua ativação precisa ser verificada online (' + Math.floor(diasSemVerificar) + ' dias sem verificar). Conecte-se à internet.', 'verificar');
    }
  }
}

// ==================== ENTER PARA ATIVAR ====================
document.getElementById('campo-chave').addEventListener('keypress', function(e) { if (e.key === 'Enter') ativar(); });

// ==================== INICIALIZAÇÃO ====================
verificarAoAbrir();
</script>

</body>
</html>`;
}

// ==================== GERAÇÃO ====================

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  PROTEGER.JS — Gerador de HTML Protegido');
console.log('═══════════════════════════════════════════════════');
console.log('');

// Verificar se HTML original existe
if (!fs.existsSync(HTML_ORIGINAL)) {
  console.error('ERRO: HTML original não encontrado:');
  console.error('  ' + HTML_ORIGINAL);
  process.exit(1);
}

console.log('1. Lendo HTML original...');
const htmlOriginal = fs.readFileSync(HTML_ORIGINAL, 'utf-8');
console.log('   Tamanho: ' + (htmlOriginal.length / 1024).toFixed(1) + ' KB');

// Extrair o conteúdo que será protegido (tudo entre <body> e </body>)
// Inclui header, nav, main e script — tudo
const matchBody = htmlOriginal.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!matchBody) {
  console.error('ERRO: Não foi possível encontrar o <body> no HTML');
  process.exit(1);
}

// Extrair também o CSS (estilo) original
const matchStyle = htmlOriginal.match(/<style>([\s\S]*?)<\/style>/i);
const cssOriginal = matchStyle ? matchStyle[1] : '';

// O conteúdo protegido inclui o CSS + corpo
const conteudoParaProteger = `<style>${cssOriginal}</style>\n${matchBody[1]}`;

console.log('2. Codificando conteúdo...');
console.log('   Conteúdo: ' + (conteudoParaProteger.length / 1024).toFixed(1) + ' KB');

// Codificar: texto UTF-8 → bytes → XOR → base64
const bytesUTF8 = unescape(encodeURIComponent(conteudoParaProteger));
const xorCodificado = xorCodificar(bytesUTF8, CHAVE_OFUSCACAO);
const base64 = Buffer.from(xorCodificado, 'binary').toString('base64');

console.log('   Base64: ' + (base64.length / 1024).toFixed(1) + ' KB');
console.log('   Chave XOR: ' + CHAVE_OFUSCACAO);

console.log('3. Gerando HTML protegido...');

// Montar HTML final
let htmlProtegido = gerarTelaAtivacao();
htmlProtegido = htmlProtegido.replace('%%CONTEUDO_CODIFICADO%%', base64);
htmlProtegido = htmlProtegido.replace('%%SERVIDOR_URL%%', SERVIDOR_URL);
htmlProtegido = htmlProtegido.replace('%%CHAVE_OFUSCACAO%%', CHAVE_OFUSCACAO);

// Salvar
fs.writeFileSync(HTML_SAIDA, htmlProtegido, 'utf-8');
const tamanhoFinal = (htmlProtegido.length / 1024).toFixed(1);

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  ✓ HTML PROTEGIDO GERADO COM SUCESSO!');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('  Arquivo: ' + HTML_SAIDA);
console.log('  Tamanho: ' + tamanhoFinal + ' KB');
console.log('  Servidor: ' + SERVIDOR_URL);
console.log('');
console.log('  Este é o arquivo que você envia ao comprador');
console.log('  junto com a chave de ativação.');
console.log('');
console.log('═══════════════════════════════════════════════════');
