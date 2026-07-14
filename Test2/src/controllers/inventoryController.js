function createInventoryController(service) {
  return {
    list(req, res, next) {
      try { res.json({ inventory: service.list() }); } catch (error) { next(error); }
    },
    create(req, res, next) {
      try { res.status(201).json({ product: service.create(req.body, req.session.user.id) }); }
      catch (error) { next(error); }
    },
    updatePriceAndCost(req, res, next) {
      try { res.json({ product: service.updatePriceAndCost(req.params.itemId, req.body, req.session.user.id) }); }
      catch (error) { next(error); }
    }
  };
}
module.exports = { createInventoryController };
