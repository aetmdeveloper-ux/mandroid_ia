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

// ── ROTA DO CHAT (MISTURAL DIRECT INFERENCE) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  try {
    // URL de fallback estável do Hugging Face
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      { 
        inputs: `[INST] Responda em português: ${message} [/INST]`,
        parameters: { max_new_tokens: 300, temperature: 0.5 }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const aiResponse = response.data[0]?.generated_text || "MANDROID: Sistema pronto.";
    // Limpa a resposta para não repetir sua pergunta
    const cleanResponse = aiResponse.split('[/INST]').pop();

    res.json({ success: true, message: cleanResponse.trim() });

  } catch (error) {
    res.json({ success: true, message: `MANDROID: Estou calibrando meus sistemas. Tente perguntar novamente agora.` });
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
app.listen(PORT, () => console.log("MANDROID ONLINE"));
