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
const axios        = require('axios');

// Configuração do Passport
require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// Essencial para o Render confiar no HTTPS e manter o login
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de Sessão Blindada para o Render
app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_ia_secret_2024',
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

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    req.session.save(() => { res.redirect('/chat'); });
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect('/');
  });
});

// --- ROTAS DE PÁGINAS (DESIGN ORIGINAL) ---
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// --- API DE CHAT (INTEGRAÇÃO GROQ) ---
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autorizado' });
  
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
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });

    const reply = responseIA.data.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: reply });

    // Envia no formato que o seu chat.html original lê
    res.json({ success: true, message: reply });
  } catch (err) {
    res.status(500).json({ error: 'Erro no terminal.' });
  }
});

// Limpar histórico (função do seu design)
app.post('/api/chat/clear', (req, res) => {
  if (req.user) conversationHistory[req.user.id] = [];
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`MANDROID ONLINE NA PORTA ${PORT}`));
