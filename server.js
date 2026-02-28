const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// --- CONFIGURAÇÕES DE MIDDLEWARE ---
// Removido Helmet para não quebrar fontes Google e Neon no Render
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- VARIÁVEIS DE AMBIENTE ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// --- ROTAS DO FRONTEND ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Mock da API de usuário (Como você ainda vai me passar o passport.js, deixei funcional)
app.get('/api/user', (req, res) => {
    // Quando o passport estiver pronto, trocaremos isso por req.user
    res.json({ 
        authenticated: true, 
        user: { name: "Adão Everton", photo: "" } 
    });
});

// --- ROTA DA GROQ (Llama 3) ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: "Mensagem vazia" });
        }

        const response = await axios.post(
            GROQ_API_URL,
            {
                model: "llama3-8b-8192", // Modelo ultra rápido da Groq
                messages: [
                    {
                        role: "system",
                        content: "Você é o MANDROID.IA, um assistente tecnológico avançado com temática neon e futurista."
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
        
        // Retorno exatamente como seu chat.html espera
        res.json({ success: true, message: aiResponse });

    } catch (error) {
        console.error('Erro na Groq:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: "O MANDROID.IA encontrou uma instabilidade nos circuitos." 
        });
    }
});

// Rota para limpar conversa (apenas para não dar erro no console do navegador)
app.post('/api/chat/clear', (req, res) => {
    res.json({ success: true });
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    =========================================
    MANDROID.IA - SISTEMA ONLINE
    PORTA: ${PORT}
    DESIGN NEON: LIBERADO (SEM HELMET)
    =========================================
    `);
});
