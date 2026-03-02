require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const https = require('https');

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

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: { displayName: req.user.displayName } });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── ROTA DO CHAT (VERSÃO MISTRAL - CORRIGIDA) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  if (!token) return res.status(500).json({ success: false, error: "HF_TOKEN ausente." });

  const promptData = JSON.stringify({ 
    inputs: `<s>[INST] Você é o MANDROID.IA. Responda em português: ${message} [/INST]`,
    parameters: { max_new_tokens: 250, temperature: 0.7, return_full_text: false }
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(promptData)
    }
  };

  const hfReq = https.request(options, (hfRes) => {
    let body = '';
    hfRes.on('data', (chunk) => { body += chunk; });
    hfRes.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.estimated_time) {
          return res.json({ success: true, message: "MANDROID: Sistema despertando... Tente em 15 segundos." });
        }
        let aiText = json[0]?.generated_text || "MANDROID: Estou online. Como posso ajudar?";
        res.json({ success: true, message: aiText.trim() });
      } catch (e) {
        res.status(500).json({ success: false, error: "Erro na resposta da IA." });
      }
    });
  });

  hfReq.on('error', (err) => res.status(500).json({ success: false, error: err.message }));
  hfReq.write(promptData);
  hfReq.end();
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => {
  req.logout((err) => { req.session.destroy(() => res.redirect('/')); });
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MANDROID ONLINE"));
