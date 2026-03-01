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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de sessão para evitar o loop de login
app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_secret_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());

// Serve a pasta public onde está seu index.html e chat.html originais
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE LOGIN ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/chat.html'); 
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// --- ROTA DA IA (GROQ) - SINCRONIZADA COM SEU CHAT.HTML ---
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: "Sessão expirada. Logue novamente." });
    }

    try {
        const { message } = req.body;
        
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: "Você é o MANDROID.IA, um assistente futurista criado por Adão Everton." },
                { role: "user", content: message }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Retorna exatamente o que o seu chat.html espera: { success: true, message: "..." }
        res.json({ 
            success: true, 
            message: response.data.choices[0].message.content 
        });

    } catch (e) {
        console.error("ERRO GROQ:", e.response ? e.response.data : e.message);
        
        // Retorna o erro no formato que seu chat.html entende
        res.status(500).json({ 
            success: false, 
            error: "Falha na conexão neural. Verifique a chave da Groq no Render." 
        });
    }
});

// Rota para pegar dados do usuário (Adão)
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MANDROID.IA ONLINE NA PORTA ${PORT}`));
