require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const https = require('https');

// Configuração do passport (Google Login)
require('./config/passport')(passport);

const app = express();

// Middlewares para o seu Frontend funcionar
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, 
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Rotas de Autenticação ───────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }), 
  (req, res) => res.redirect('/chat.html')
);

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, error: 'Erro no logout' });
    req.session.destroy(() => res.redirect('/'));
  });
});

// Rota que coloca seu nome no topo do MANDROID.IA
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: { displayName: req.user.displayName } });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── ROTA DO CHAT (MOTOR HUGGING FACE - SEM ERRO 404) ─────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  if (!token) return res.status(500).json({ success: false, error: "Chave HF_TOKEN não configurada no Render." });

  // Modelo Qwen 2.5: rápido e entende português perfeitamente
  const data = JSON.stringify({ 
    inputs: `<|im_start|>system\nVocê é o MANDROID.IA, um assistente futurista e prestativo criado pelo Adão.<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`,
    parameters: { max_new_tokens: 500, return_full_text: false }
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/Qwen/Qwen2.5-72B-Instruct',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const hfReq = https.request(options, (hfRes) => {
    let responseBody = '';
    hfRes.on('data', (chunk) => { responseBody += chunk; });
    hfRes.on('end', () => {
      try {
        const json = JSON.parse(responseBody);
        
        // Se o motor estiver carregando (comum na primeira vez do dia)
        if (json.estimated_time) {
          return res.json({ success: true, message: "MANDROID: Sistema despertando... Tente novamente em 20 segundos." });
        }

        const aiText = json[0]?.generated_text || "MANDROID: Sistema pronto. Pode falar.";
        res.json({ success: true, message: aiText });
      } catch (e) {
        res.status(500).json({ success: false, error: "Erro no processamento da IA." });
      }
    });
  });

  hfReq.on('error', (err) => res.status(500).json({ success: false, error: err.message }));
  hfReq.write(data);
  hfReq.end();
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MANDROID ONLINE - PORTA ${PORT}`));
