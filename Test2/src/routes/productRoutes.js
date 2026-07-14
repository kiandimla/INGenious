const express = require('express');
function createProductRoutes(products) {
  const router = express.Router();
  router.get('/available', (req, res) => res.json({ products: products.listAvailable() }));
  return router;
}
module.exports = { createProductRoutes };
