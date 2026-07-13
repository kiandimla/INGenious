const express = require("express");

function createSaleRoutes(controller) {
  const router = express.Router();

  router.get("/next-invoice", controller.getNextInvoice);
  router.post("/", controller.create);

  return router;
}

module.exports = {
  createSaleRoutes
};