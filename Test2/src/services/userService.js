const bcrypt = require('bcryptjs');
const { withImmediateTransaction } = require('../db/transaction');
const { HttpError } = require('../utils/httpError');

function createUserService(db, users) {
  return {
    list() { return users.list(); },
    async create(input) {
      const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
      const password = String(input.password ?? '');
      const resetKey = String(input.resetKey ?? '');
      if (!name || name.length > 100) throw new HttpError(400, 'VALIDATION_ERROR', 'Username must contain 1-100 characters.');
      if (password.length < 3 || password.length > 200) throw new HttpError(400, 'WEAK_PASSWORD', 'Password must contain 3-200 characters.');
      if (resetKey.length < 8 || resetKey.length > 200) throw new HttpError(400, 'WEAK_RESET_KEY', 'Reset key must contain 8-200 characters.');
      if (users.findByName(name)) throw new HttpError(409, 'USER_EXISTS', 'User already exists.');
      const [passwordHash, resetKeyHash] = await Promise.all([
        bcrypt.hash(password, 12), bcrypt.hash(resetKey, 12)
      ]);
      return withImmediateTransaction(db, () => {
        if (users.findByName(name)) throw new HttpError(409, 'USER_EXISTS', 'User already exists.');
        return users.create({ name, passwordHash, resetKeyHash, isAdmin: input.isAdmin ? 1 : 0 });
      });
    },
    deactivate(idInput, signedInUserId) {
      const id = Number(idInput);
      if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'User ID is invalid.');
      return withImmediateTransaction(db, () => {
        const target = users.findById(id);
        if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
        if (!target.isActive) throw new HttpError(409, 'USER_INACTIVE', 'User is already inactive.');
        if (target.id === signedInUserId) throw new HttpError(409, 'CANNOT_DELETE_SELF', 'You cannot deactivate your signed-in account.');
        // Preserve original behavior: administrators cannot be removed through this screen.
        if (target.isAdmin) throw new HttpError(409, 'CANNOT_DELETE_ADMIN', 'Administrator accounts cannot be deactivated here.');
        const result = users.deactivate(id);
        if (result.changes !== 1) throw new HttpError(409, 'USER_CHANGED', 'User changed before the request completed.');
        return { ...target, isActive: 0 };
      });
    }
  };
}
module.exports = { createUserService };
