require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const https = require('https'); // Nativo, não dá erro de "not found"

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

// ── Rota do chat (VERSÃO DIRETA E NATIVA) ──────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Faça login primeiro" });

  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Dados para o Google
  const data = JSON.stringify({
    contents: [{ parts: [{ text: message }] }]
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
          res.status(500).json({ success: false, error: json.error.message });
        } else {
          const aiText = json.candidates[0].content.parts[0].text;
          res.json({ success: true, message: aiText });
        }
      } catch (e) {
        res.status(500).json({ success: false, error: "Erro ao ler resposta do Google" });
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
