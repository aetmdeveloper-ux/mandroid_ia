require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Conecta com sua configuração de login
require('./config/passport')(passport);

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configura a sessão para o login funcionar
app.use(session({
  secret: 'mandroid_secret_2026',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// --- ROTAS DE LOGIN ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => { res.redirect('/chat.html'); }
);

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) { res.json(req.user); } 
  else { res.status(401).json({ error: "Não autorizado" }); }
});

// --- ROTA DO CHAT (GEMINI) ---
app.post('/api/chat', async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(req.body.message);
    const response = await result.response;
    res.json({ success: true, message: response.text() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('MANDROID ONLINE COM LOGIN E GEMINI'));
