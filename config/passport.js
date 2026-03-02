const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function(passport) {
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,'http://localhost:3000/auth/google/callback'
    callbackURL: process.env.CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL || '',
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }));
};
