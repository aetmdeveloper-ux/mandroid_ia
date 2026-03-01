require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('./config/passport')(passport);

const app = express();

// Instancia a IA fora da rota para maior estabilidade
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret_2026',
  resave: true,
  saveUninitialized: false,
  cookie: { 
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Rotas de Autenticação
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => {
  req.logout((err) => {
    req.session.destroy(() => res.redirect('/'));
  });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: { displayName: req.user.displayName } });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── Rota do chat (Gemini) ───────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Faça login primeiro" });

  const { message } = req.body;
  
  try {
    // Usaremos o modelo "gemini-1.5-flash" de forma direta
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Adicionamos uma configuração de segurança básica para evitar bloqueios
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    res.json({ success: true, message: text });
  } catch (error) {
    console.error("ERRO DETALHADO:", error); // Isso vai aparecer no log do Render
    res.status(500).json({
      success: false,
      error: "Erro na conexão com Google: " + error.message
    });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MANDROID ONLINE → PORTA ${PORT}`));
