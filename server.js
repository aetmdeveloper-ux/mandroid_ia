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

// Middlewares para o seu Frontend futurista funcionar
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

// ── ROTA DO CHAT (VERSÃO MISTRAL - RESPOSTAS VARIADAS) ─────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  if (!token) return res.status(500).json({ success: false, error: "Chave HF_TOKEN não configurada no Render." });

  // Formato de Prompt para o Mistral (Garante que ele responda ao que você perguntou)
  const data = JSON.stringify({ 
    inputs: `<s>[INST] Você é o MANDROID.IA, um assistente prestativo. Responda em português de forma clara: ${message} [/INST]`,
    parameters: { 
      max_new_tokens: 500, 
      return_full_text: false,
      temperature: 0.7 // Dá mais "liberdade" para ele não repetir sempre a mesma coisa
    }
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
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
        
        // Se o motor estiver carregando
        if (json.estimated_time || json.error?.includes("currently loading")) {
          return res.json({ success: true, message: "MANDROID: Sistema despertando... Tente em 15 segundos." });
        }

        // Pega o texto gerado da estrutura do Hugging Face
        let aiText = "";
        if (Array.isArray(json) && json[0]?.generated_text) {
          aiText = json[0].generated_text;
        } else if (json.generated_text) {
          aiText = json.generated_text;
        } else {
          aiText = "MANDROID: Recebi sua mensagem, mas estou processando. Pode repetir?";
        }

        res.json({ success: true, message: aiText.trim() });
      } catch (e) {
        console.error("Erro no Parse:", responseBody);
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
app.listen(PORT, () => console.log(`MANDROID ONLINE - MOTOR MISTRAL PRONTO`));
