function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Please sign in.' } });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user?.isAdmin) {
    return res.status(403).json({ error: { code: 'ADMIN_REQUIRED', message: 'Administrator access is required.' } });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
