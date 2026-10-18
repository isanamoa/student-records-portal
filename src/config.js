require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  rpID: process.env.RP_ID || 'localhost',
  rpName: process.env.RP_NAME || 'Student Records Portal',
  origin: process.env.ORIGIN || 'http://localhost:3000',
};
