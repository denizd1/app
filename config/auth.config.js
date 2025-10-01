module.exports = {
  secret: process.env.JWTSECRET,
  jwtExpiration: 86400, // 1 hour
  jwtRefreshExpiration: 86400, // 24 hours

  /* for test */
  // jwtExpiration: 60,          // 1 minute
  // jwtRefreshExpiration: 120,  // 2 minutes
};
