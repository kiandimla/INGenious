const express = require('express');
function createDeliveryRoutes(controller) {
  const router = express.Router();
  router.post('/', controller.create);
  return router;
}
module.exports = { createDeliveryRoutes };
