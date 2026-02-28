// ====================================================
//  MANDROID.IA - Servidor Principal (VERSÃO GROQ)
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
const axios        = require('axios'); // Mudança: Usamos axios para a Groq

// ── Configuração do Passport ──────
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// IMPORTANTE PARA O RENDER: Confiar no HTTPS para manter o login
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de Sessão corrigida para o Render
app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret_2026',
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
    // Chamada oficial para a API da Groq
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

    // Mantém o formato exato que seu chat.html original espera
    res.json({ success: true, message: botReply });

  } catch (err) {
    console.error('ERRO NO TERMINAL IA:', err.message);
    res.status(500).json({ error: 'Falha na conexão com o terminal central.' });
  }
});

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
  (req, res) => {
    // Garante que a sessão gravou antes de mudar de página
    req.session.save(() => { res.redirect('/chat'); });
  }
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
