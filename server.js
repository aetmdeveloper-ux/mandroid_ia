require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// carrega configuração do passport
require('./config/passport')(passport);

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// AJUSTE NA SESSÃO PARA FUNCIONAR NO RENDER
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

// ── Rotas de autenticação ───────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/chat.html');
  }
);

// Logout
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Informações do usuário logado
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.emails?.[0]?.value,
        photo: req.user.photos?.[0]?.value
      }
    });
  } else {
    res.status(401).json({ success: false, error: "Não autorizado" });
  }
});

// ── Rota do chat (Gemini) ───────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "Faça login primeiro" });
  }

  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ success: false, error: "Mensagem inválida" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    // ALTERAÇÃO AQUI: USANDO O MODELO LATEST PARA EVITAR ERROS DE VERSÃO
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const result = await model.generateContent(message.trim());
    const response = await result.response;

    res.json({ success: true, message: response.text() });
  } catch (error) {
    console.error("Erro Gemini:", error);
    res.status(500).json({
      success: false,
      error: "Erro na IA: " + error.message
    });
  }
});

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MANDROID ONLINE → http://localhost:${PORT}`);
});
