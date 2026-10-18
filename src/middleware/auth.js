/**
 * Authentication middleware – requires a valid server-side session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Unauthenticated',
      message: 'Valid session required. Please sign in with your passkey.',
    });
  }
  next();
}

/**
 * Role guard.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${req.session.role}' is not permitted for this action.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
