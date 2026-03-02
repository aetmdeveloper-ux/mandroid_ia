require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const axios = require('axios');

require('./config/passport')(passport);
const app = express();

app.use(express.json());
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

// ── ROTA DO CHAT (SEM RESPOSTAS PROGRAMADAS) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  try {
    // Chamada direta para o modelo mais inteligente do Hugging Face
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
      { 
        inputs: `<s>[INST] Você é o MANDROID.IA. Responda em português: ${message} [/INST]`,
        parameters: { max_new_tokens: 500, temperature: 0.7, return_full_text: false }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Se a IA responder, pegamos o texto puro dela
    const aiResponse = response.data[0]?.generated_text || "Erro: A IA não gerou texto.";
    res.json({ success: true, message: aiResponse.trim() });

  } catch (error) {
    // Se der erro, mostramos o erro REAL da API para sabermos o que é
    const errorMsg = error.response?.data?.error || error.message;
    res.json({ success: true, message: `ERRO DA FONTE: ${errorMsg}` });
  }
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) res.json({ success: true, user: { displayName: req.user.displayName } });
  else res.status(401).json({ success: false });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => { req.logout(() => { req.session.destroy(() => res.redirect('/')); }); });
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MANDROID CONECTADO À FONTE"));
