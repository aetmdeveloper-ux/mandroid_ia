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
  secret: process.env.SESSION_SECRET || 'mandroid_2026_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Histórico de conversa por sessão ──────────────────────────
const conversationHistory = new Map();

function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  return conversationHistory.get(sessionId);
}

// ── Função principal: chama HuggingFace com fallback de modelos ──
async function callHuggingFace(userMessage, history, token) {
  // Lista de modelos em ordem de prioridade (fallback automático)
  const models = [
    {
      id: 'mistralai/Mistral-7B-Instruct-v0.3',
      buildPrompt: (msg, hist) => {
        const system = `Você é MANDROID.IA, um assistente de inteligência artificial avançado e futurista criado por Adão Everton Tavares. Responda SEMPRE em português brasileiro. Seja preciso, direto, informativo e útil. Nunca repita respostas genéricas.`;
        let prompt = `<s>[INST] ${system}\n\n`;
        // Inclui até 6 trocas anteriores para contexto
        const recent = hist.slice(-6);
        for (let i = 0; i < recent.length; i++) {
          const entry = recent[i];
          if (entry.role === 'user') {
            prompt += `${entry.content} [/INST] `;
          } else {
            prompt += `${entry.content} </s><s>[INST] `;
          }
        }
        prompt += `${msg} [/INST]`;
        return prompt;
      }
    },
    {
      id: 'HuggingFaceH4/zephyr-7b-beta',
      buildPrompt: (msg, hist) => {
        const system = `Você é MANDROID.IA, um assistente de inteligência artificial avançado e futurista criado por Adão Everton Tavares. Responda SEMPRE em português brasileiro. Seja preciso, direto, informativo e útil.`;
        let prompt = `<|system|>\n${system}</s>\n`;
        const recent = hist.slice(-6);
        for (const entry of recent) {
          if (entry.role === 'user') {
            prompt += `<|user|>\n${entry.content}</s>\n<|assistant|>\n`;
          } else {
            prompt += `${entry.content}</s>\n`;
          }
        }
        prompt += `<|user|>\n${msg}</s>\n<|assistant|>\n`;
        return prompt;
      }
    },
    {
      id: 'tiiuae/falcon-7b-instruct',
      buildPrompt: (msg, hist) => {
        const system = `Você é MANDROID.IA, um assistente de IA futurista. Responda sempre em português.`;
        let prompt = `System: ${system}\n\n`;
        const recent = hist.slice(-4);
        for (const entry of recent) {
          if (entry.role === 'user') {
            prompt += `User: ${entry.content}\n`;
          } else {
            prompt += `Assistant: ${entry.content}\n`;
          }
        }
        prompt += `User: ${msg}\nAssistant:`;
        return prompt;
      }
    }
  ];

  for (const model of models) {
    try {
      console.log(`[MANDROID] Tentando modelo: ${model.id}`);
      const prompt = model.buildPrompt(userMessage, history);

      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${model.id}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false   // ← CRÍTICO: retorna só a resposta, não o prompt inteiro
          },
          options: {
            wait_for_model: true,    // ← CRÍTICO: aguarda modelo carregar (evita erro 503)
            use_cache: false          // ← Evita resposta em cache (respostas sempre diferentes)
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 segundos de timeout
        }
      );

      // Extrai o texto da resposta
      let text = '';
      if (Array.isArray(response.data) && response.data.length > 0) {
        text = response.data[0]?.generated_text || '';
      } else if (response.data?.generated_text) {
        text = response.data.generated_text;
      } else if (typeof response.data === 'string') {
        text = response.data;
      }

      // Limpa artefatos comuns de formato
      text = text
        .replace(/<\|assistant\|>/gi, '')
        .replace(/<\|user\|>/gi, '')
        .replace(/<\|system\|>/gi, '')
        .replace(/\[INST\]/gi, '')
        .replace(/\[\/INST\]/gi, '')
        .replace(/<\/s>/gi, '')
        .replace(/^Assistant:/i, '')
        .trim();

      if (text && text.length > 10) {
        console.log(`[MANDROID] Sucesso com modelo: ${model.id}`);
        return { success: true, text };
      }

      console.warn(`[MANDROID] Resposta vazia do modelo: ${model.id}`);
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error || err.message;
      console.error(`[MANDROID] Erro no modelo ${model.id} [${status}]:`, errMsg);
      // Continua para o próximo modelo
    }
  }

  return { success: false, text: null };
}

// ── ROTA PRINCIPAL DO CHAT ────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
  }

  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Mensagem não pode estar vazia.' });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    console.error('[MANDROID] HF_TOKEN não configurado!');
    return res.json({
      success: false,
      error: '⚠️ Configuração incompleta: HF_TOKEN não encontrado nas variáveis de ambiente.'
    });
  }

  const sessionId = req.sessionID;
  const history = getHistory(sessionId);

  // Chama a IA com histórico
  const result = await callHuggingFace(message.trim(), history, token);

  if (result.success && result.text) {
    // Salva no histórico (usuário + resposta da IA)
    history.push({ role: 'user', content: message.trim() });
    history.push({ role: 'assistant', content: result.text });

    // Limita histórico a 20 entradas (10 trocas)
    if (history.length > 20) {
      conversationHistory.set(sessionId, history.slice(-20));
    }

    return res.json({ success: true, message: result.text });
  }

  // Se todos os modelos falharam
  return res.json({
    success: false,
    error: '⚠️ Os servidores de IA estão sobrecarregados. Aguarde 30 segundos e tente novamente.'
  });
});

// ── LIMPAR HISTÓRICO DA SESSÃO ────────────────────────────────
app.post('/api/clear-history', (req, res) => {
  if (req.isAuthenticated()) {
    conversationHistory.delete(req.sessionID);
    console.log(`[MANDROID] Histórico limpo para sessão: ${req.sessionID}`);
  }
  res.json({ success: true });
});

// ── ROTA DE INFO DO USUÁRIO ───────────────────────────────────
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      user: {
        displayName: req.user.displayName,
        email: req.user.emails?.[0]?.value || '',
        photo: req.user.photos?.[0]?.value || ''
      }
    });
  } else {
    res.status(401).json({ success: false });
  }
});

// ── ROTAS DE AUTENTICAÇÃO ─────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => res.redirect('/chat.html')
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.redirect('/'));
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat.html', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// ── INICIA O SERVIDOR ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 MANDROID.IA ONLINE — Porta ${PORT}`);
  console.log(`📡 HF_TOKEN: ${process.env.HF_TOKEN ? '✅ Configurado' : '❌ NÃO configurado!'}`);
  console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`);
});
