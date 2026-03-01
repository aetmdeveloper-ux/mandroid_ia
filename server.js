require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

require('./config/passport')(passport);

const app = express();

// 1. Configurações de parsing e CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuração de Sessão (IMPORTANTE: Antes do passport.session)
app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// 3. Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// 4. Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Redireciona explicitamente para a página de chat após sucesso
        res.redirect('/chat.html'); 
    }
);

// Rota para o chat (protegida)
app.get('/chat', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } else {
        res.redirect('/');
    }
});

// Rota Groq (Axios)
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({error: "Não autorizado"});
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: req.body.message }]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        });
        res.json({ success: true, message: response.data.choices[0].message.content });
    } catch (e) { res.status(500).json({ error: "Erro na IA" }); }
});

app.listen(process.env.PORT || 3000, () => console.log("MANDROID Online"));
