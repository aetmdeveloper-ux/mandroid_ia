require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const cors         = require('cors');
const helmet       = require('helmet');
const bodyParser   = require('body-parser');
const path         = require('path');
const axios        = require('axios'); 

require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// PASTA PADRÃO (Certifique-se de renomear no GitHub para 'public')
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

const conversationHistory = {};

// Autenticação
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => { res.redirect('/chat'); });
app.get('/auth/logout', (req, res) => { req.logout(() => { res.redirect('/'); }); });

// Rotas de Páginas
app.get('/', (req, res) => { 
  res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

app.get('/chat', (req, res) => { 
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'bate-papo.html')); 
});

// Rota da IA
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const userId = req.user ? req.user.id : 'default';

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [{ role: 'system', content: 'Você é o MANDROID.IA. Seja profissional e não use emojis.' }];
  }
  conversationHistory[userId].push({ role: 'user', content: message });

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: conversationHistory[userId]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });

    const reply = response.data.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: reply });

    res.json({ response: reply, suggestions: ["Exemplo", "Como funciona?"] });
  } catch (err) {
    res.status(500).json({ response: 'Erro ao processar.' });
  }
});

app.listen(PORT, () => console.log(`MANDROID online na porta ${PORT}`));
