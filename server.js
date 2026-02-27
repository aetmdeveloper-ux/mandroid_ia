// ====================================================
//  MANDROID.IA - Servidor Principal
//  by mandroidapp; Adão Everton Tavares
// ====================================================

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const cors         = require('cors');
const helmet       = require('helmet');
const bodyParser   = require('body-parser');
const path         = require('path');
const OpenAI       = require('openai');

// ── Configuração do Passport / Google OAuth ──────
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── OpenAI Client ─────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Middlewares ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Sessão ────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// ── Passport ──────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── Histórico de conversas em memória ────────────
const conversationHistory = {};

// ============================================================
//  ROTAS DE AUTENTICAÇÃO
// ============================================================

// Iniciar login com Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback do Google
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    res.redirect('/chat');
  }
);

// Logout
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    req.session.destroy();
    res.redirect('/');
  });
});

// Dados do usuário logado
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.displayName,
        email: req.user.emails?.[0]?.value,
        photo: req.user.photos?.[0]?.value
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ============================================================
//  ROTAS DE PÁGINAS
// ============================================================

// Página inicial (login)
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Página de chat (protegida)
app.get('/chat', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// ============================================================
//  API DE CHAT - OPENAI
// ============================================================
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  // Inicializa histórico do usuário
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      {
        role: 'system',
        content: `Você é MANDROID.IA, uma inteligência artificial avançada e futurista criada por mandroidapp (Adão Everton Tavares). 
        Você é altamente inteligente, preciso, direto e confiável. 
        Responda sempre em português brasileiro de forma clara, objetiva e detalhada. 
        Quando apropriado, use formatação para tornar as respostas mais legíveis.
        Você tem personalidade tecnológica, futurista e empática.`
      }
    ];
  }

  // Adiciona mensagem do usuário
  conversationHistory[userId].push({ role: 'user', content: message });

  // Limita histórico a 20 mensagens para controlar tokens
  if (conversationHistory[userId].length > 21) {
    const systemMsg = conversationHistory[userId][0];
    conversationHistory[userId] = [systemMsg, ...conversationHistory[userId].slice(-20)];
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: conversationHistory[userId],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: assistantMessage });

    res.json({
      success: true,
      message: assistantMessage,
      tokens: completion.usage?.total_tokens
    });

  } catch (err) {
    console.error('Erro OpenAI:', err.message);

    // Resposta de fallback se OpenAI não estiver configurado
    if (err.code === 'invalid_api_key' || err.message.includes('API key')) {
      return res.json({
        success: true,
        message: `⚠️ **MANDROID.IA** está em modo demonstração.\n\nPara ativar a IA completa, configure sua chave OpenAI no arquivo **.env**:\n\`\`\`\nOPENAI_API_KEY=sua_chave_aqui\n\`\`\`\n\nSua pergunta foi: *"${message}"*\n\nAcesse **https://platform.openai.com/api-keys** para obter sua chave.`
      });
    }

    res.status(500).json({ error: 'Erro ao processar sua mensagem. Tente novamente.' });
  }
});

// Limpar histórico de conversa
app.post('/api/chat/clear', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  if (conversationHistory[userId]) {
    const systemMsg = conversationHistory[userId][0];
    conversationHistory[userId] = [systemMsg];
  }
  res.json({ success: true, message: 'Histórico limpo.' });
});

// ============================================================
//  MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

// ============================================================
//  INICIALIZAÇÃO DO SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        🤖  MANDROID.IA  🤖               ║');
  console.log('║  by mandroidapp; Adão Everton Tavares    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Servidor rodando em:                    ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log('╚══════════════════════════════════════════╝\n');
});
