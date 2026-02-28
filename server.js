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

// HELMET: Configurado para o seu visual neon carregar sem bloqueios
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- CAMINHO DA PASTA: Usando 'público' como está no seu GitHub ---
app.use(express.static(path.join(__dirname, 'público')));

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

// --- ROTAS DE PÁGINAS: CORRIGIDAS COM OS NOMES DO SEU GITHUB ---
app.get('/', (req, res) => { 
  res.sendFile(path.join(__dirname, 'público', 'index.html')); 
});

app.get('/chat', (req, res) => { 
  if (!req.isAuthenticated()) return res.redirect('/');
  // USANDO 'chat.html' PORQUE É ESTE O NOME QUE ESTÁ NO SEU GITHUB
  res.sendFile(path.join(__dirname, 'público', 'chat.html')); 
});

// Rota da IA
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const userId = req.user ? req.user.id : 'default';

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [{ 
        role: 'system', 
        content: 'Você é o MANDROID.IA. Seja profissional e direto. Criado por Adão Everton Tavares.' 
    }];
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

    res.json({ 
      success: true, 
      response: reply, 
      suggestions: ["Explique mais", "Dê um exemplo"] 
    });

  } catch (err) {
    res.status(500).json({ response: 'Erro no terminal.' });
  }
});

app.listen(PORT, () => console.log(`MANDROID online na porta ${PORT}`));
