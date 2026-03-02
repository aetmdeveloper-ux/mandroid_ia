require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const https = require('https'); // Nativo do Node, não precisa instalar nada

require('./config/passport')(passport);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_2026',
  resave: false, saveUninitialized: false,
  cookie: { secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// ROTA DO CHAT - DIRETO NO FLUXO
app.post('/api/chat', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send("Não autorizado");

  const data = JSON.stringify({
    inputs: `[INST] Responda em português: ${req.body.message} [/INST]`,
    parameters: { max_new_tokens: 500, return_full_text: false }
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const hfReq = https.request(options, (hfRes) => {
    let responseData = '';
    hfRes.on('data', (chunk) => { responseData += chunk; });
    hfRes.on('end', () => {
      try {
        const result = JSON.parse(responseData);
        // Se a IA responder, manda o texto. Se não, manda o erro da API.
        const output = result[0]?.generated_text || result.error || "Erro desconhecido";
        res.json({ success: true, message: output });
      } catch (e) {
        res.json({ success: false, message: "Erro ao ler resposta da IA" });
      }
    });
  });

  hfReq.on('error', (err) => res.json({ success: false, message: err.message }));
  hfReq.write(data);
  hfReq.end();
});

// Rotas Base
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) res.json({ success: true, user: { displayName: req.user.displayName } });
  else res.status(401).json({ success: false });
});
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MANDROID ON"));
