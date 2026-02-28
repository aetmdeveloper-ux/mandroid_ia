// ====================================================
//  MANDROID.IA - Servidor Principal (VERSÃO GROQ)
//  by mandroidapp; Adão Everton Tavares
// ====================================================

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const cors         = require('cors');
const bodyParser   = require('body-parser');
const path         = require('path');
const axios        = require('axios'); // Usamos axios para ligar à Groq

// ── Configuração do Passport (Pasta config) ──────
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuração para o Render (Resolve erro de login)
app.set('trust proxy', 1);

// Removido o Helmet para não bloquear o seu design neon e fontes Google
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_ia_2026',
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

// ── Rota da API de Chat (100% GROQ) ──────
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      { role: 'system', content: 'Você é o MANDROID.IA. Responda de forma direta e profissional. NÃO use emojis.' }
    ];
  }
  conversationHistory[userId].push({ role: 'user', content: message });

  try {
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

    // Envia no formato exato que o seu chat.html original espera
    res.json({ success: true, message: botReply });

  } catch (err) {
    console.error('ERRO GROQ:', err.message);
    res.status(500).json({ error: 'Erro no servidor central.' });
  }
});

app.post('/api/chat/clear', ensureAuthenticated, (req, res) => {
  if (conversationHistory[req.user.id]) {
    conversationHistory[req.user.id] = [conversationHistory[req.user.id][0]];
  }
  res.json({ success: true });
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

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        🤖  MANDROID.IA ONLINE  🤖        ║');
  console.log('║  by mandroidapp; Adão Everton Tavares    ║');
  console.log('╚══════════════════════════════════════════╝');
});
