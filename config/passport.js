// ====================================================
//  MANDROID.IA - Configuração Passport / Google OAuth
//  by mandroidapp; Adão Everton Tavares
// ====================================================

const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function(passport) {
  // Serialização do usuário na sessão
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialização do usuário
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

 // Estratégia Google OAuth 2.0
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || 'https://mandroid-ia.onrender.com/auth/google/callback',
  },
