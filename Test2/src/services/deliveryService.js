const { withImmediateTransaction } = require('../db/transaction');
const { HttpError } = require('../utils/httpError');

const PURPOSES = new Set(['DELIVERIES', 'ADJUSTMENT', 'PCOUNT', 'TRANSFER']);
const SUPPLIERS = new Set(['TGP PHARMA', 'CNN', 'PITC', 'PPGI', 'OTHERS']);

function positiveInteger(value, field, max = 999999) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} is invalid.`);
  }
  return number;
}
function moneyToCentavos(value, field) {
  const string = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(string)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a nonnegative amount with at most two decimals.`);
  }
  const [whole, fraction = ''] = string.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is too large.`);
  return cents;
}
function isoDate(value, field, required = true) {
  if (!value && !required) return null;
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a valid YYYY-MM-DD date.`);
  }
  return text;
}

function createDeliveryService(db, products, deliveries) {
  function create(input, userId) {
    const supplier = String(input.supplier ?? '').trim().toUpperCase();
    const purpose = String(input.purpose ?? '').trim().toUpperCase();
    const invoiceNumber = String(input.invoiceNumber ?? '').trim();
    const deliveryDate = isoDate(input.deliveryDate, 'Delivery date');
    const pageNumber = positiveInteger(input.pageNumber, 'Page number', 9999);
    const pageCount = positiveInteger(input.pageCount, 'Page count', 9999);
    const remarks = String(input.remarks ?? '').trim().slice(0, 500);
    if (!SUPPLIERS.has(supplier)) throw new HttpError(400, 'VALIDATION_ERROR', 'Supplier is invalid.');
    if (!PURPOSES.has(purpose)) throw new HttpError(400, 'VALIDATION_ERROR', 'Purpose is invalid.');
    if (!invoiceNumber || invoiceNumber.length > 100) throw new HttpError(400, 'VALIDATION_ERROR', 'Invoice number is required.');
    if (pageNumber > pageCount) throw new HttpError(400, 'VALIDATION_ERROR', 'Page number cannot exceed page count.');
    if (!remarks) throw new HttpError(400, 'VALIDATION_ERROR', 'Remarks are required.');
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 500) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'A delivery must contain between 1 and 500 items.');
    }

    const parsedItems = input.items.map(raw => ({
      productId: String(raw.productId ?? '').trim(),
      quantity: positiveInteger(raw.quantity, 'Quantity'),
      unitCostCentavos: moneyToCentavos(raw.unitCost, 'Unit cost'),
      expiryDate: raw.expiryDate ? isoDate(raw.expiryDate, 'Expiry date') : null
    }));
    if (parsedItems.some(item => !item.productId)) throw new HttpError(400, 'VALIDATION_ERROR', 'Each item requires productId.');
    const duplicateKey = new Set();
    for (const item of parsedItems) {
      const key = `${item.productId}\u0000${item.expiryDate || ''}`;
      if (duplicateKey.has(key)) throw new HttpError(400, 'DUPLICATE_ITEM', 'Duplicate product and expiry lines are not allowed.');
      duplicateKey.add(key);
    }

    return withImmediateTransaction(db, () => {
      const productRows = products.findActiveByIds([...new Set(parsedItems.map(item => item.productId))]);
      const productMap = new Map(productRows.map(product => [product.itemId, product]));
      if (productMap.size !== new Set(parsedItems.map(item => item.productId)).size) {
        throw new HttpError(400, 'UNKNOWN_PRODUCT', 'One or more products are missing or inactive.');
      }
      for (const item of parsedItems) {
        const product = productMap.get(item.productId);
        if (product.isPerishable && !item.expiryDate) {
          throw new HttpError(400, 'EXPIRY_REQUIRED', `${product.itemName} requires an expiry date.`);
        }
      }

      let delivery = deliveries.findDelivery(invoiceNumber, deliveryDate);
      let deliveryId;
      if (delivery) {
        if (delivery.supplier !== supplier || delivery.purpose !== purpose) {
          throw new HttpError(409, 'DELIVERY_HEADER_CONFLICT', 'Existing invoice pages use a different supplier or purpose.');
        }
        deliveryId = delivery.id;
      } else {
        deliveryId = deliveries.createDelivery({ invoiceNumber, deliveryDate, supplier, purpose, remarks, userId });
      }
      if (deliveries.findPage(deliveryId, pageNumber)) {
        throw new HttpError(409, 'PAGE_EXISTS', 'This invoice page has already been saved.');
      }

      const pageTotalCentavos = parsedItems.reduce((sum, item) => sum + item.unitCostCentavos * item.quantity, 0);
      const deliveryPageId = deliveries.createPage({ deliveryId, pageNumber, pageCount, pageTotalCentavos });
      for (const item of parsedItems) {
        const product = productMap.get(item.productId);
        const before = product.quantity;
        const subtotalCentavos = item.unitCostCentavos * item.quantity;
        const deliveryItemId = deliveries.insertItem({ deliveryPageId, productId: item.productId,
          itemName: product.itemName, unitCostCentavos: item.unitCostCentavos,
          quantity: item.quantity, expiryDate: item.expiryDate, subtotalCentavos });
        const updated = deliveries.incrementStock(item.productId, item.quantity);
        if (updated.changes !== 1) throw new HttpError(409, 'STOCK_UPDATE_FAILED', `Could not update ${product.itemName}.`);
        if (purpose === 'DELIVERIES') deliveries.updateProductCost(item.productId, item.unitCostCentavos, userId);
        const movementType = purpose === 'DELIVERIES' ? 'DELIVERY' : 'ADJUSTMENT_IN';
        deliveries.addMovement({ productId: item.productId, movementType, quantityChange: item.quantity,
          stockBefore: before, stockAfter: before + item.quantity, deliveryItemId,
          reason: `${purpose}: ${remarks}`, userId });
        product.quantity += item.quantity;
      }
      return { id: Number(deliveryId), invoiceNumber, deliveryDate, supplier, purpose,
        pageNumber, pageCount, pageTotalCentavos,
        nextPage: pageNumber < pageCount ? pageNumber + 1 : null };
    });
  }
  return { create };
}
module.exports = { createDeliveryService };
