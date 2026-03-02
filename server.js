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

// ── ROTA DO CHAT (ENDEREÇO ATUALIZADO DO HUGGING FACE) ──────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  try {
    // USANDO O NOVO ENDEREÇO 'router.huggingface.co' EXIGIDO PELA API
    const response = await axios.post(
      'https://router.huggingface.co/models/mistralai/Mistral-Nemo-Instruct-2407',
      { 
        inputs: `<s>[INST] Você é o MANDROID.IA. Responda em português de forma clara e completa: ${message} [/INST]`,
        parameters: { max_new_tokens: 500, temperature: 0.7, return_full_text: false }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Pegamos a resposta real gerada pela IA
    const aiResponse = response.data[0]?.generated_text || "MANDROID: Conectado, mas aguardando processamento.";
    res.json({ success: true, message: aiResponse.trim() });

  } catch (error) {
    // Se ainda houver erro, mostramos o motivo real aqui
    const errorDetail = error.response?.data?.error || error.message;
    res.json({ success: true, message: `ERRO DE CONEXÃO: ${errorDetail}` });
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
app.listen(PORT, () => console.log("MANDROID ATUALIZADO"));
