// ====================================================
//  MANDROID.IA - Servidor Principal (RESET TOTAL - GROQ)
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
const axios        = require('axios'); // MUDANÇA: USANDO AXIOS PARA GROQ

// ── Configuração do Passport / Google OAuth ──────
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuração para o Render (Resolve o problema do login)
app.set('trust proxy', 1);

// ── Middlewares (Mantendo sua estrutura original) ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_ia_secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const conversationHistory = {};

// ── Rota da API de Chat (100% GROQ - SEM OPENAI) ──
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      { role: 'system', content: 'Você é o MANDROID.IA. Criado por Adão Everton Tavares. Responda de forma direta e profissional. NÃO use emojis.' }
    ];
  }

  conversationHistory[userId].push({ role: 'user', content: message });

  try {
    // Chamada oficial para a Groq
    const responseIA = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: conversationHistory[userId]
    }, {
      headers: { 
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const botReply = responseIA.data.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: botReply });

    // Envia no formato que o seu chat.html original espera
    res.json({ success: true, message: botReply });

  } catch (err) {
    console.error('ERRO NO TERMINAL IA:', err.message);
    res.status(500).json({ error: 'Falha na conexão com o terminal central.' });
  }
});

// ── Outras Rotas (Fiel ao seu código original) ──
app.post('/api/chat/clear', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  if (conversationHistory[userId]) {
    const systemMsg = conversationHistory[userId][0];
    conversationHistory[userId] = [systemMsg];
  }
  res.json({ success: true, message: 'Histórico limpo.' });
});

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => { req.session.save(() => res.redirect('/chat')); }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect('/');
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

// Seu log personalizado do terminal
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        🤖  MANDROID.IA ONLINE  🤖        ║');
  console.log('║  by mandroidapp; Adão Everton Tavares    ║');
  console.log('╚══════════════════════════════════════════╝');
});
