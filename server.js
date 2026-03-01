require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

// Importa sua config do passport (aquela que você já tem)
require('./config/passport')(passport);

const app = express();

// 1. Configurações de Dados
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. CONFIGURAÇÃO DE SESSÃO (AJUSTADA PARA O RENDER)
app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_secret_key_2026',
    resave: true,            // Força a sessão a ser salva
    saveUninitialized: true, // Garante que a sessão exista
    cookie: { 
        secure: false,       // Deixe false para o Render aceitar sem HTTPS complexo no início
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// 3. Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// 4. Servir seus arquivos originais (seu index.html com Robô e Matrix)
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE LOGIN (Onde o loop acontecia) ---

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Forçamos o redirecionamento para o arquivo físico do chat
        res.redirect('/chat.html'); 
    }
);

// Rota de API para a Groq (IA)
app.post('/api/chat', async (req, res) => {
    // Se não estiver logado, avisa o sistema
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Acesso negado" });

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: "Você é o MANDROID.IA, assistente de Adão Everton." },
                { role: "user", content: req.body.message }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, message: response.data.choices[0].message.content });
    } catch (e) {
        res.status(500).json({ error: "Erro na rede neural" });
    }
});

// Rota para o seu chat.html saber quem é você
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 MANDROID ON - Porta ${PORT}`));
