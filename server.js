require('dotenv').config();
const express      = require('express');
const session      = require('session');
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

// HELMET AJUSTADO: Para não bloquear o carregamento do chat
app.use(helmet({
  contentSecurityPolicy: false, 
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORREÇÃO 1: Nome da pasta igual ao seu GitHub ('público')
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

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }), (req, res) => { res.redirect('/chat'); });

app.get('/auth/logout', (req, res) => { 
  req.logout((err) => { 
    req.session.destroy(); 
    res.redirect('/'); 
  }); 
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: { id: req.user.id, name: req.user.displayName, email: req.user.emails?.[0]?.value, photo: req.user.photos?.[0]?.value } });
  } else { res.json({ authenticated: false }); }
});

// CORREÇÃO 2: Rotas apontando para a pasta 'público' e arquivo 'bate-papo.html'
app.get('/', (req, res) => { 
  if (req.isAuthenticated()) return res.redirect('/chat'); 
  res.sendFile(path.join(__dirname, 'público', 'index.html')); 
});

app.get('/chat', ensureAuthenticated, (req, res) => { 
  res.sendFile(path.join(__dirname, 'público', 'bate-papo.html')); 
});

app.post('/api/clear', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  if (conversationHistory[userId]) { delete conversationHistory[userId]; }
  res.json({ success: true });
});

app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [{ 
        role: 'system', 
        content: 'Você é o MANDROID.IA. Seja profissional, direto e não use emojis. Se perguntarem quem você é, diga que é mandroidapp.ia desenvolvido por Adão Everton Tavares.' 
    }];
  }
  conversationHistory[userId].push({ role: 'user', content: message });

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: conversationHistory[userId]
    }, {
      headers: { 
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
        'Content-Type': 'application/json' 
      }
    });

    const reply = response.data.choices[0].message.content;
    conversationHistory[userId].push({ role: 'assistant', content: reply });

    // CORREÇÃO 3: Resposta enviada como 'response' e inclusão de sugestões
    const sugestoes = ["Me dê um exemplo", "Como isso funciona?", "Próximo passo"];
    
    res.json({ 
      success: true, 
      response: reply, 
      suggestions: sugestoes 
    });

  } catch (err) {
    console.error('Erro Groq:', err.response?.data || err.message);
    res.status(500).json({ response: 'Erro ao processar mensagem.' });
  }
});

function ensureAuthenticated(req, res, next) { if (req.isAuthenticated()) return next(); res.redirect('/'); }

app.listen(PORT, () => { console.log(`MANDROID.IA pronto na porta ${PORT}`); });
