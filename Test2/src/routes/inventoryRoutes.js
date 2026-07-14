const express = require('express');
const { requireAdmin } = require('../middleware/auth');
function createInventoryRoutes(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.post('/products', requireAdmin, controller.create);
  router.patch('/products/:itemId/pricing', requireAdmin, controller.updatePriceAndCost);
  return router;
}
module.exports = { createInventoryRoutes };
