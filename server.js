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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }), (req, res) => { res.redirect('/chat'); });
app.get('/auth/logout', (req, res) => { req.logout((err) => { req.session.destroy(); res.redirect('/'); }); });

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: { id: req.user.id, name: req.user.displayName, email: req.user.emails?.[0]?.value, photo: req.user.photos?.[0]?.value } });
  } else { res.json({ authenticated: false }); }
});

app.get('/', (req, res) => { if (req.isAuthenticated()) return res.redirect('/chat'); res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/chat', ensureAuthenticated, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'chat.html')); });

// --- CONEXÃO COM A GROQ COM PERSONALIDADE DIVERTIDA ---
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!conversationHistory[userId]) {
    // AQUI ESTÁ A MUDANÇA: PERSONALIDADE AMIGÁVEL E DIVERTIDA
    conversationHistory[userId] = [{ 
        role: 'system', 
        content: 'Você é o MANDROID.IA, um parceiro de criação super divertido, amigável e entusiasmado, criado pelo desenvolvedor Adão Everton Tavares. Use muitos emojis (🚀, ✨, 🤖), seja sempre positivo, engraçado e trate o Adão como um grande mestre da tecnologia! Se ele pedir ajuda, explique com alegria!' 
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
    res.json({ success: true, message: reply });

  } catch (err) {
    console.error('Erro Groq:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao processar mensagem.' });
  }
});

function ensureAuthenticated(req, res, next) { if (req.isAuthenticated()) return next(); res.redirect('/'); }

app.listen(PORT, () => { console.log(`MANDROID.IA pronto na porta ${PORT}`); });
