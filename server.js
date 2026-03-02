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

// Rota de Usuário para exibir seu nome no cabeçalho
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: { displayName: req.user.displayName } });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── ROTA DO CHAT (AJUSTE DEFINITIVO PARA RESPOSTA REAL) ─────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Logue primeiro" });

  const { message } = req.body;
  const token = process.env.HF_TOKEN;

  // Montamos o prompt no formato que o Mistral entende melhor
  const promptData = JSON.stringify({ 
    inputs: `<s>[INST] Você é o MANDROID.IA. Responda de forma curta e prestativa em português: ${message} [/INST]`,
    parameters: { 
      max_new_tokens: 250, 
      temperature: 0.7, 
      return_full_text: false 
    }
  });

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const hfReq = https.request(options, (hfRes) => {
    let body = '';
    hfRes.on('data', (chunk) => { body += chunk; });
    hfRes.on('end', () => {
      try {
        const json = JSON.parse(body);
        
        // Se a IA estiver carregando após o deploy
        if (json.estimated_time) {
          return res.json({ success: true, message: "MANDROID: Sistema despertando... Tente em 15 segundos." });
        }

        // EXTRAÇÃO ROBUSTA: Tenta pegar o texto de qualquer forma que ele venha
        let aiResponse = "";
        if (Array.isArray(json) && json[0]?.generated_text) {
          aiResponse = json[0].generated_text;
        } else if (json.generated_text) {
          aiResponse = json.generated_text;
        } else if (typeof json === 'string') {
          aiResponse = json;
        }

        // Se mesmo assim vier vazio, avisamos que o motor falhou
        if (!aiResponse || aiResponse.trim() === "") {
          aiResponse = "MANDROID: Processador de linguagem em standby. Pergunte novamente, por favor.";
        }

        res.json({ success: true, message: aiResponse.trim() });
      } catch (e) {
        res.status(500).json({ success: false, error: "Falha no núcleo de inteligência." });
      }
    });
  });

  hfReq.on('error', (err) => res.status(500).json({ success: false, error: err.message }));
  hfReq.write(promptData);
  hfReq.end();
});

  const options = {
    hostname: 'api-inference.huggingface.co',
    path: '/models/mistralai/Mistral-7B-Instruct-v0.3', // Modelo estável
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
        
        // Se a IA ainda estiver carregando (comum após novo deploy)
        if (json.estimated_time) {
          return res.json({ success: true, message: "MANDROID: Sistema despertando... Tente novamente em 20 segundos." });
        }

        // Extrai o texto gerado de forma segura
        let aiText = "";
        if (Array.isArray(json) && json[0]?.generated_text) {
          aiText = json[0].generated_text;
        } else if (json.generated_text) {
          aiText = json.generated_text;
        } else {
          aiText = "MANDROID: Recebi sua mensagem, mas meu núcleo de resposta oscilou. Pode repetir?";
        }

        res.json({ success: true, message: aiText.trim() });
      } catch (e) {
        res.status(500).json({ success: false, error: "Erro na leitura do motor." });
      }
    });
  });

  hfReq.on('error', (err) => res.status(500).json({ success: false, error: err.message }));
  hfReq.write(promptData);
  hfReq.end();
});

// Rotas de Auth e Logout
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/chat.html'));
app.get('/logout', (req, res) => {
  req.logout((err) => { req.session.destroy(() => res.redirect('/')); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MANDROID ONLINE"));
