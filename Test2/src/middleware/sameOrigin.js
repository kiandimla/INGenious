function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // Barcode/POS clients and same-origin form posts may omit Origin.
  const expected = `${req.protocol}://${req.get('host')}`;
  if (origin !== expected) {
    return res.status(403).json({ error: { code: 'BAD_ORIGIN', message: 'Cross-origin request rejected.' } });
  }
  next();
}
module.exports = { requireSameOrigin };
