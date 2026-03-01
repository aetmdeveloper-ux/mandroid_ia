require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
const path = require('path');

require('./config/passport')(passport);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mandroid_key',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// ROTA DE CHAT - AGORA MOSTRANDO O ERRO REAL NA TELA
app.post('/api/chat', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Logue primeiro" });

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: req.body.message }]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ success: true, message: response.data.choices[0].message.content });
    } catch (e) {
        // Se der erro, ele vai enviar o motivo real para o seu chat
        const erroReal = e.response ? JSON.stringify(e.response.data) : e.message;
        console.error("ERRO:", erroReal);
        res.status(500).json({ error: "ERRO REAL: " + erroReal });
    }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/chat.html');
});

app.listen(process.env.PORT || 3000, () => console.log("MANDROID Online"));
