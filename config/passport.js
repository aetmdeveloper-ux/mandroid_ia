const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function(passport) {
  // Salva o usuário na sessão
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Recupera o usuário da sessão
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Corrigido para usar o nome exato do seu arquivo .env
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://mandroid-ia.onrender.com/auth/google/callback',
    proxy: true // Essencial para funcionar corretamente no Render (HTTPS)
  },
  (accessToken, refreshToken, profile, done) => {
    // Retorna o perfil do Google para o Express
    return done(null, profile);
  }));
};
