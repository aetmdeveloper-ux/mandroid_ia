require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const cors = require('cors');

const app = express();

/* =========================
   CONFIGURAÇÕES IMPORTANTES
========================= */

// 🔥 MUITO IMPORTANTE PARA RENDER
app.set('trust proxy', 1);

// CORS (ajuste se frontend for domínio diferente)
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   SESSION CONFIGURADA CORRETAMENTE
========================= */

app.use(session({
  secret: process.env.SESSION_SECRET || 'mandroid_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS no Render
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

/* =========================
   GOOGLE AUTH
========================= */

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

/* =========================
   ROTAS DE AUTENTICAÇÃO
========================= */

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/chat.html');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

/* =========================
   MIDDLEWARE PROTEÇÃO
========================= */

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Não autenticado' });
}

/* =========================
   ROTA DO CHAT PROTEGIDA
========================= */

app.post('/api/chat', ensureAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;

    // 👉 Aqui entra sua lógica Gemini
    // Exemplo fictício:
    const response = "Resposta da IA para: " + message;

    res.json({ reply: response });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

/* =========================
   ARQUIVOS ESTÁTICOS
========================= */

app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   START SERVIDOR
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
