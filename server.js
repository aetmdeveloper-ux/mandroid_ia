require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const axios = require('axios'); // Mudamos para axios para ser mais robusto

require('./config/passport')(passport);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── ROTA DO CHAT (VERSÃO TURBO COM GOOGLE GEMMA) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/google/gemma-2-9b-it',
      { 
        inputs: `<start_of_turn>user\nVocê é o MANDROID.IA. Responda em português de forma clara: ${message}<end_of_turn>\n<start_of_turn>model\n`,
        parameters: { max_new_tokens: 500, temperature: 0.7 }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let aiText = "";
    if (Array.isArray(response.data)) {
        aiText = response.data[0].generated_text.split('model\n').pop();
    } else {
        aiText = response.data.generated_text;
    }

    res.json({ success: true, message: aiText.trim() });

  } catch (error) {
    console.error("Erro no HF:", error.response?.data || error.message);
    res.json({ success: true, message: "MANDROID: Estou reconectando meus sensores. Pode perguntar de novo em 10 segundos?" });
  }
});

// Rotas de Auth e User
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) res.json({ success: true, user: { displayName: req.user.displayName } });
  else res.status(401).json({ success: false });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => { req.logout((err) => { req.session.destroy(() => res.redirect('/')); }); });
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MANDROID PRONTO"));
