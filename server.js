require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const axios = require('axios');

require('./config/passport')(passport);

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_2026_reset',
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
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Acesso negado' });
  const { message } = req.body;
  const uid = req.user.id;

  if (!history[uid]) {
    history[uid] = [{ role: 'system', content: 'Você é o MANDROID.IA. Responda de forma direta e profissional. NÃO use emojis.' }];
  }
  history[uid].push({ role: 'user', content: message });

  try {
    const responseIA = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: history[uid]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });

    const reply = responseIA.data.choices[0].message.content;
    history[uid].push({ role: 'assistant', content: reply });
    res.json({ success: true, message: reply });

  } catch (err) {
    res.status(500).json({ error: 'Erro no terminal central.' });
  }
});

// --- ROTAS ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  req.session.save(() => res.redirect('/chat'));
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect('/');
  });
});

app.post('/api/chat/clear', (req, res) => {
  if (req.user) history[req.user.id] = [];
  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log('MANDROID ONLINE'));
