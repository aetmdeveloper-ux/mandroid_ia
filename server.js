require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const path         = require('path');
const axios        = require('axios'); 
const bodyParser   = require('body-parser');

require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 1. PASTA CORRETA (COMO NO SEU GITHUB) ---
app.use(express.static(path.join(__dirname, 'público')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret',
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// --- 2. ROTAS DE PÁGINAS (NOMES EXATOS DO SEU PRINT) ---
app.get('/', (req, res) => { 
  res.sendFile(path.join(__dirname, 'público', 'index.html')); 
});

app.get('/chat', (req, res) => { 
  if (!req.isAuthenticated()) return res.redirect('/');
  // Aqui estava o erro: Tem que ser 'chat.html'
  res.sendFile(path.join(__dirname, 'público', 'chat.html')); 
});

// --- 3. ROTA DA IA (SEM ERRO DE UNDEFINED) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const responseIA = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });

    const reply = responseIA.data.choices[0].message.content;

    // Resposta que o seu HTML original espera
    res.json({ response: reply });

  } catch (err) {
    res.status(500).json({ response: 'Erro no terminal central.' });
  }
});

// Outras rotas (Login/Logout)
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => { res.redirect('/chat'); });
app.get('/auth/logout', (req, res) => { req.logout(() => { res.redirect('/'); }); });

app.listen(PORT, () => console.log(`SISTEMA MANDROID ONLINE`));
