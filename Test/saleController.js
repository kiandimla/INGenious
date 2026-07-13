function createSaleController(service, repository) {
  return {
    getNextInvoice(req, res, next) {
      try {
        const invoiceNumber = repository.getNextInvoiceNumber();

        res.json({
          invoiceNumber
        });
      } catch (error) {
        next(error);
      }
    },

    create(req, res, next) {
      try {
        const sale = service.create(
          req.body,
          req.session.user.id
        );

        res.status(201).json({
          sale
        });
      } catch (error) {
        next(error);
      }
    }
  };
}

module.exports = {
  createSaleController
};