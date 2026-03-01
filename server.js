require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

// Importa sua config do passport
require('./config/passport')(passport);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/chat.html');
    }
);

// --- ROTA DA IA (GROQ) ---
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autorizado" });

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: "Você é o MANDROID.IA." },
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
        console.error("Erro Groq:", e.response ? e.response.data : e.message);
        res.status(500).json({ error: "Erro na rede neural" });
    }
});

// Para o chat.html carregar seus dados
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MANDROID Online na porta ${PORT}`));
