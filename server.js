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
  secret: process.env.SESSION_SECRET || 'mandroid_secret_2026',
  resave: true,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Autenticação
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => {
  req.logout((err) => { req.session.destroy(() => res.redirect('/')); });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: { displayName: req.user.displayName } });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── ROTA DO CHAT: MUDANÇA PARA O MODELO "GEMINI-PRO" (VERSÃO 1) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Faça login primeiro" });

  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  const data = JSON.stringify({
    contents: [{ parts: [{ text: message }] }]
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    // Mudamos para gemini-pro na v1, que é o caminho mais seguro contra o erro 404
    path: `/v1/models/gemini-pro:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const gReq = https.request(options, (gRes) => {
    let responseData = '';
    gRes.on('data', (chunk) => { responseData += chunk; });
    gRes.on('end', () => {
      try {
        const json = JSON.parse(responseData);
        if (json.error) {
          res.status(500).json({ success: false, error: "Google diz: " + json.error.message });
        } else if (json.candidates && json.candidates[0].content) {
          const aiText = json.candidates[0].content.parts[0].text;
          res.json({ success: true, message: aiText });
        } else {
          res.status(500).json({ success: false, error: "Resposta vazia do Google." });
        }
      } catch (e) {
        res.status(500).json({ success: false, error: "Erro no processamento da IA." });
      }
    });
  });

  gReq.on('error', (e) => {
    res.status(500).json({ success: false, error: e.message });
  });

  gReq.write(data);
  gReq.end();
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MANDROID ONLINE`));
