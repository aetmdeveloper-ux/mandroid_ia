// ====================================================
//  MANDROID.IA - Servidor Principal (Groq Edition)
//  by Adão Everton Tavares
// ====================================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Importa sua configuração do Passport
require('./config/passport')(passport);

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÕES DO SERVIDOR ---
// HELMET REMOVIDO conforme solicitado para não quebrar o design neon
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURAÇÃO DE SESSÃO (Essencial para Login) ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- VARIÁVEIS DA GROQ ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// --- MIDDLEWARE DE PROTEÇÃO ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// --- ROTAS DE AUTENTICAÇÃO (GOOGLE) ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/chat')
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// --- ROTAS DE PÁGINAS ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Retorna dados do usuário logado para o chat
app.get('/api/user', ensureAuthenticated, (req, res) => {
    res.json({
        authenticated: true,
        user: {
            name: req.user.displayName,
            photo: req.user.photos[0].value
        }
    });
});

// --- ROTA DA IA (GROQ + AXIOS) ---
app.post('/api/chat', ensureAuthenticated, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: "Mensagem vazia." });
        }

        const response = await axios.post(
            GROQ_API_URL,
            {
                model: "llama3-8b-8192", // Modelo rápido da Groq
                messages: [
                    {
                        role: "system",
                        content: "Você é o MANDROID.IA, um assistente futurista criado por Adão Everton. Responda de forma tecnológica e prestativa."
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        res.json({ success: true, message: aiResponse });

    } catch (error) {
        console.error('Erro na Groq:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: "O MANDROID.IA detectou uma falha nos circuitos neurais. Tente novamente." 
        });
    }
});

// Rota de Limpeza (Necessária para o botão do chat.html)
app.post('/api/chat/clear', ensureAuthenticated, (req, res) => {
    res.json({ success: true, message: "Histórico reiniciado localmente." });
});

// --- INICIALIZAÇÃO ---
app.listen(PORT, () => {
    console.log(`
    =========================================
    🤖 MANDROID.IA - ONLINE (SEM HELMET)
    🚀 Sincronizado com Groq & Google OAuth
    📍 Porta: ${PORT}
    =========================================
    `);
});
