const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Ensure DB is initialised
require('./db');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const courseRoutes = require('./routes/courses');
const securityDemoRoutes = require('./routes/security-demo');

const app = express();

// Middleware
app.use(cors({
  origin: config.origin,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === 'production', // true only behind HTTPS
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/auth', authRoutes);
app.use('/demo', securityDemoRoutes);
app.get('/students/:studentId', (req, res, next) => {
  const accept = req.get('accept') || '';
  if (!accept.toLowerCase().includes('text/html')) return next();

  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use('/students', studentRoutes);
app.use('/courses', courseRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rpID: config.rpID, origin: config.origin });
});

// Fallback for SPA-style pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(config.port, () => {
  console.log(`Student Records Portal running at ${config.origin}`);
  console.log(`RP ID: ${config.rpID}`);
  console.log('Ready for WebAuthn registration & login.');
});
