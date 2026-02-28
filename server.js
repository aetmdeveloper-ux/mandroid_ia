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

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Rota de Chat com a Groq (Sem Emojis)
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autorizado' });
  const { message } = req.body;
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Você é o MANDROID.IA. Responda de forma profissional e direta. NÃO use emojis.' },
        { role: 'user', content: message }
      ]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });
    // Ajustado para o formato que o seu chat.html original espera
    res.json({ success: true, message: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Erro no terminal.' });
  }
});

// Rotas de Redirecionamento
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => res.redirect('/chat')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect('/');
  });
});

app.listen(PORT, () => console.log(`MANDROID ONLINE`));
