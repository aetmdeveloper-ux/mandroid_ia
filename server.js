// ====================================================
//  MANDROID.IA - Servidor Principal (Versão GROQ)
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
const axios        = require('axios'); // Usando axios para a Groq

// ── Configuração do Passport / Google OAuth ──────
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
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
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const conversationHistory = {};

// ============================================================
//  ROTAS DE PÁGINAS E AUTENTICAÇÃO
// ============================================================

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => { res.redirect('/chat'); }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    req.session.destroy();
    res.redirect('/');
  });
});

// ============================================================
//  API DE CHAT - GROQ CLOUD
// ============================================================
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      { role: 'system', content: 'Você é o MANDROID.IA, criado por Adão Everton Tavares. Seja profissional e não use emojis.' }
    ];
  }

  conversationHistory[userId].push({ role: 'user', content: message });

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: conversationHistory[userId]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });

    const botReply = response.data.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: botReply });

    // Mantendo o formato 'message' que o seu chat.html original espera
    res.json({ success: true, message: botReply });

  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar mensagem na Groq.' });
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

app.listen(PORT, () => console.log(`MANDROID.IA ONLINE NA PORTA ${PORT}`));
