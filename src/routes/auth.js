const express = require('express');
const router = express.Router();
const db = require('../db');
const webauthn = require('../services/webauthn');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /auth/register/options
 * Body: { username }
 * Returns WebAuthn registration options (after identifying the account).
 */
router.post('/register/options', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'username required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const options = await webauthn.getRegistrationOptions(user);
    req.session.currentChallenge = options.challenge;
    req.session.registrationUserId = user.id;

    res.json(options);
  } catch (err) {
    console.error('register/options error:', err.message);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

/**
 * POST /auth/register/verify
 * Body: WebAuthn registration response
 */
router.post('/register/verify', async (req, res) => {
  try {
    const expectedChallenge = req.session.currentChallenge;
    const userId = req.session.registrationUserId;

    if (!expectedChallenge || !userId) {
      return res.status(400).json({ error: 'No registration in progress' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await webauthn.verifyAndStoreRegistration(
      user,
      req.body,
      expectedChallenge
    );

    // Clear challenge
    delete req.session.currentChallenge;
    delete req.session.registrationUserId;

    res.json({ verified: true, credentialID: result.credentialID });
  } catch (err) {
    console.error('register/verify error:', err.message);
    res.status(400).json({ error: 'Registration verification failed', detail: err.message });
  }
});

/**
 * POST /auth/login/options
 * Body: { username }
 */
router.post('/login/options', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'username required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const options = await webauthn.getAuthenticationOptions(user);
    req.session.currentChallenge = options.challenge;
    req.session.loginUserId = user.id;

    res.json(options);
  } catch (err) {
    console.error('login/options error:', err.message);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

/**
 * POST /auth/login/verify
 * Body: WebAuthn authentication response
 */
router.post('/login/verify', async (req, res) => {
  try {
    const expectedChallenge = req.session.currentChallenge;
    const userId = req.session.loginUserId;

    if (!expectedChallenge || !userId) {
      return res.status(400).json({ error: 'No login in progress' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await webauthn.verifyAuthentication(user, req.body, expectedChallenge);

    // Create authenticated session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.displayName = user.display_name;

    delete req.session.currentChallenge;
    delete req.session.loginUserId;

    res.json({
      verified: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error('login/verify error:', err.message);
    res.status(400).json({ error: 'Authentication failed', detail: err.message });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /auth/me – current session info
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    displayName: req.session.displayName,
  });
});

module.exports = router;
