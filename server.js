require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const cors         = require('cors');
const helmet       = require('helmet');
const bodyParser   = require('body-parser');
const path         = require('path');
const axios        = require('axios'); // Usamos Axios para conectar na Groq

require('./config/passport')(passport);

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuração para o Render (Resolve o problema de ficar na mesma tela)
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
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

// --- API DE CHAT (MOTO GROQ) ---
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
    // Chamada direta para a API da Groq
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

    // Resposta no formato que o seu chat.html original espera
    res.json({ success: true, message: botReply });

  } catch (err) {
    console.error('Erro na Groq:', err.message);
    res.status(500).json({ error: 'Erro no servidor central da IA.' });
  }
});

// Outras rotas (Mantendo seu design original)
app.post('/api/chat/clear', ensureAuthenticated, (req, res) => {
  if (conversationHistory[req.user.id]) conversationHistory[req.user.id] = [conversationHistory[req.user.id][0]];
  res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  req.session.save(() => res.redirect('/chat'));
});
app.get('/auth/logout', (req, res) => {
  req.logout(() => { req.session.destroy(); res.redirect('/'); });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

app.listen(PORT, () => console.log('MANDROID ONLINE NA PORTA ' + PORT));
