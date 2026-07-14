const { withImmediateTransaction } = require('../db/transaction');
const { HttpError } = require('../utils/httpError');

function moneyToCentavos(value, field) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a nonnegative amount with at most two decimals.`);
  }
  const [whole, fraction = ''] = text.split('.');
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(number)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is too large.`);
  return number;
}

function createInventoryService(db, inventory) {
  return {
    list() { return inventory.list(); },
    create(input, userId) {
      const itemId = String(input.itemId ?? '').trim().toUpperCase();
      const itemName = String(input.itemName ?? '').trim().replace(/\s+/g, ' ');
      if (!/^[A-Z0-9]{1,40}$/.test(itemId)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Item ID must contain 1-40 letters or digits.');
      }
      if (!itemName || itemName.length > 200) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Item name must contain 1-200 characters.');
      }
      const value = {
        itemId, itemName,
        priceCentavos: moneyToCentavos(input.price, 'Price'),
        costCentavos: moneyToCentavos(input.cost, 'Cost'),
        isPerishable: input.isPerishable ? 1 : 0,
        userId
      };
      return withImmediateTransaction(db, () => {
        if (inventory.findById(itemId)) throw new HttpError(409, 'ITEM_ID_EXISTS', 'Item ID already exists.');
        if (inventory.findByName(itemName)) throw new HttpError(409, 'ITEM_NAME_EXISTS', 'Item name already exists.');
        return inventory.create(value);
      });
    },
    updatePriceAndCost(itemIdInput, input, userId) {
      const itemId = String(itemIdInput ?? '').trim().toUpperCase();
      const value = {
        itemId,
        priceCentavos: moneyToCentavos(input.price, 'Price'),
        costCentavos: moneyToCentavos(input.cost, 'Cost'),
        userId
      };
      return withImmediateTransaction(db, () => {
        const product = inventory.updatePriceAndCost(value);
        if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
        return product;
      });
    }
  };
}
module.exports = { createInventoryService };
