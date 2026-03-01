require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('./config/passport')(passport);

const app = express();
// Configura o motor Gemini com a chave do Render
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_2026_safe',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// AQUI ESTÁ A ALMA DO MANDROID.IA
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: "Acesso negado" });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Instrução para esconder o "rótulo da Coca-Cola"
        const promptSystem = "Você é o MANDROID.IA, um assistente robótico de elite com interface Matrix, criado exclusivamente pelo desenvolvedor Adão Everton. " +
                             "Nunca mencione que você é um modelo de IA do Google ou que se chama Gemini. " +
                             "Responda sempre de forma futurista, técnica e prestativa.";

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: promptSystem }] },
                { role: "model", parts: [{ text: "Entendido. Protocolos MANDROID.IA ativos. Eu sou a criação de Adão Everton." }] }
            ],
        });

        const result = await chat.sendMessage(req.body.message);
        const response = await result.response;
        
        res.json({ success: true, message: response.text() });
    } catch (e) {
        console.error("ERRO:", e);
        res.status(500).json({ success: false, error: "Falha nos circuitos centrais: " + e.message });
    }
});

// Rotas de Autenticação originais
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/chat.html');
});

app.get('/api/user', (req, res) => {
    res.json(req.isAuthenticated() ? { authenticated: true, user: req.user } : { authenticated: false });
});

app.listen(process.env.PORT || 3000, () => console.log("🤖 MANDROID.IA ONLINE E OPERACIONAL"));
