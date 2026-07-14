function createDeliveryController(service) {
  return {
    create(req, res, next) {
      try {
        const delivery = service.create(req.body, req.session.user.id);
        res.status(201).json({ delivery });
      } catch (error) { next(error); }
    }
  };
}
module.exports = { createDeliveryController };
