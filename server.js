require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

// Importa sua config original do passport
require('./config/passport')(passport);

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CONFIGURAÇÃO DE SESSÃO (Para não deslogar sozinho)
app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_ultra_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Aponta para a pasta onde estão seus arquivos originais (index.html com robô, etc)
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Redireciona para o chat após logar
        res.redirect('/chat');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// --- ROTAS DE PÁGINAS ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } else {
        res.redirect('/');
    }
});

// Dados do usuário para o chat.html original
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                displayName: req.user.displayName,
                photos: req.user.photos
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// --- CONEXÃO COM A GROQ (IA) ---
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Logue primeiro" });

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
        console.error("Erro na Groq:", e.message);
        res.status(500).json({ success: false, message: "Erro no processamento neural." });
    }
});

// Rota para o botão de limpar conversa do seu chat.html
app.post('/api/chat/clear', (req, res) => res.json({ success: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MANDROID.IA pronto na porta ${PORT}`));
