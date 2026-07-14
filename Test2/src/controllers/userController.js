function createUserController(service) {
  return {
    list(req, res, next) {
      try { res.json({ users: service.list() }); } catch (error) { next(error); }
    },
    create(req, res, next) {
      service.create(req.body)
        .then(user => res.status(201).json({ user }))
        .catch(next);
    },
    deactivate(req, res, next) {
      try {
        const user = service.deactivate(req.params.id, req.session.user.id);
        res.json({ user });
      } catch (error) { next(error); }
    }
  };
}
module.exports = { createUserController };
