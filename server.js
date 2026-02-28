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

// HELMET: Configurado para não bloquear o seu visual neon
app.use(helmet({
  contentSecurityPolicy: false, 
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- CORREÇÃO DE CAMINHO (IGUAL AO SEU GITHUB) ---
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

// ROTA SAIR
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

// --- ROTAS DE PÁGINAS (CORRIGIDAS) ---
app.get('/', (req, res) => { 
  if (req.isAuthenticated()) return res.redirect('/chat'); 
  res.sendFile(path.join(__dirname, 'público', 'index.html')); 
});

app.get('/chat', ensureAuthenticated, (req, res) => { 
  // Apontando para o nome exato do seu arquivo no GitHub
  res.sendFile(path.join(__dirname, 'público', 'bate-papo.html')); 
});

app.post('/api/clear', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  if (conversationHistory[userId]) { delete conversationHistory[userId]; }
  res.json({ success: true });
});

// --- ROTA DA IA (SEM EMOJIS E COM SUGESTÕES) ---
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [{ 
        role: 'system', 
        content: 'Você é o MANDROID.IA. Seja profissional, direto e não use emojis. Se perguntarem quem é você ou o que é mandroidapp, diga que é mandroidapp.ia desenvolvido por Adão Everton Tavares (aetm.developer@gmail.com).' 
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

    // Sugestões para o usuário clicar
    const sugestoes = ["Me dê um exemplo", "Explique melhor", "Próximo passo"];

    // Resposta formatada para o seu HTML
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
