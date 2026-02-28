require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');

require('./config/passport')(passport);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração para o Render (Segurança de HTTPS)
app.set('trust proxy', 1);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sessão Blindada (Resolve o erro de ficar na mesma tela)
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

const history = {};

// --- API DE CHAT (GROQ) ---
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Acesso Negado' });
  const { message } = req.body;
  const uid = req.user.id;

  if (!history[uid]) history[uid] = [{ role: 'system', content: 'Você é o MANDROID.IA. Responda de forma profissional e direta. NÃO use emojis.' }];
  history[uid].push({ role: 'user', content: message });

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: history[uid]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });
    const botMsg = response.data.choices[0].message.content;
    history[uid].push({ role: 'assistant', content: botMsg });
    res.json({ success: true, message: botMsg });
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor central.' });
  }
});

// --- ROTAS DE LOGIN E PÁGINAS ---
app.get('/', (req, res) => req.isAuthenticated() ? res.redirect('/chat') : res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => req.isAuthenticated() ? res.sendFile(path.join(__dirname, 'public', 'chat.html')) : res.redirect('/'));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  req.session.save(() => res.redirect('/chat'));
});
app.get('/auth/logout', (req, res) => req.logout(() => res.redirect('/')));

app.listen(PORT, () => console.log('MANDROID ONLINE'));
