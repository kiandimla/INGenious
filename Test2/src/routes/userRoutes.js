const express = require('express');
function createUserRoutes(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.delete('/:id', controller.deactivate);
  return router;
}
module.exports = { createUserRoutes };
