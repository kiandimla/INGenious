const { withImmediateTransaction } = require('../db/transaction');
const { HttpError } = require('../utils/httpError');

function integer(value, field, min, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} is invalid.`);
  }
  return number;
}

function createSaleService(db, products, sales) {
  function create(input, userId) {
    const invoiceNumber = String(input.invoiceNumber ?? '').trim();
    if (!/^\d{1,40}$/.test(invoiceNumber)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Invoice number must contain digits only.');
    }
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 500) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'A sale must contain between 1 and 500 items.');
    }

    const merged = new Map();
    for (const raw of input.items) {
      const productId = String(raw.productId ?? '').trim();
      if (!productId) throw new HttpError(400, 'VALIDATION_ERROR', 'Each item requires productId.');
      const quantity = integer(raw.quantity, 'Quantity', 1, 999999);
      const applyDiscount = Boolean(raw.applyDiscount);
      const discountPercent = applyDiscount ? integer(raw.discountPercent ?? input.discountPercent ?? 20, 'Discount percent', 0, 99) : 0;
      const old = merged.get(productId);
      if (old && (old.applyDiscount !== applyDiscount || old.discountPercent !== discountPercent)) {
        throw new HttpError(400, 'DUPLICATE_ITEM_OPTIONS', 'Duplicate product lines must use the same discount.');
      }
      merged.set(productId, { productId, quantity: (old?.quantity || 0) + quantity, applyDiscount, discountPercent,
        discountRemarks: applyDiscount ? String(raw.discountRemarks ?? input.discountRemarks ?? '').trim().slice(0, 500) : null });
    }

    return withImmediateTransaction(db, () => {
      if (sales.findByInvoice(invoiceNumber)) {
        throw new HttpError(409, 'INVOICE_EXISTS', 'This invoice number has already been saved.');
      }
      const requested = [...merged.values()];
      const productRows = products.findActiveByIds(requested.map(item => item.productId));
      const productMap = new Map(productRows.map(product => [product.itemId, product]));
      if (productRows.length !== requested.length) {
        throw new HttpError(400, 'UNKNOWN_PRODUCT', 'One or more products are missing or inactive.');
      }

      let gross = 0, discount = 0, vat = 0, net = 0;
      const lines = requested.map(item => {
        const product = productMap.get(item.productId);
        if (product.quantity < item.quantity) {
          throw new HttpError(409, 'INSUFFICIENT_STOCK', `${product.itemName} has only ${product.quantity} item(s) available.`,
            { productId: product.itemId, available: product.quantity, requested: item.quantity });
        }
        const grossLine = product.priceCentavos * item.quantity;
        const discountLine = Math.round(grossLine * item.discountPercent / 100);
        const netLine = grossLine - discountLine;
        // The HBS screen treats VAT as included in the displayed total and uses 12%.
        const vatLine = product.isExempt ? 0 : Math.round(netLine * 12 / 112);
        gross += grossLine; discount += discountLine; vat += vatLine; net += netLine;
        return { ...item, product, grossLine, discountLine, vatLine, netLine };
      });

      const saleId = sales.createSale({ invoiceNumber, saleDate: new Date().toISOString().slice(0, 10),
        grossTotalCentavos: gross, discountTotalCentavos: discount, vatTotalCentavos: vat,
        netTotalCentavos: net, userId });

      for (const line of lines) {
        const before = line.product.quantity;
        const update = sales.decrementStock(line.productId, line.quantity);
        if (update.changes !== 1) throw new HttpError(409, 'INSUFFICIENT_STOCK', `Stock changed for ${line.product.itemName}; retry the sale.`);
        const saleItemId = sales.insertItem({ saleId, productId: line.productId, itemName: line.product.itemName,
          unitPriceCentavos: line.product.priceCentavos, unitCostCentavos: line.product.costCentavos,
          quantity: line.quantity, discountBasisPoints: line.discountPercent * 100,
          isDiscounted: line.applyDiscount ? 1 : 0, discountRemarks: line.discountRemarks,
          grossSubtotalCentavos: line.grossLine, discountAmountCentavos: line.discountLine,
          vatAmountCentavos: line.vatLine, netSubtotalCentavos: line.netLine });
        sales.addMovement({ productId: line.productId, quantityChange: -line.quantity, stockBefore: before,
          stockAfter: before - line.quantity, saleItemId, reason: `Invoice ${invoiceNumber}`, userId });
      }
      return { id: Number(saleId), invoiceNumber, grossTotalCentavos: gross, discountTotalCentavos: discount,
        vatTotalCentavos: vat, netTotalCentavos: net, nextSuggestedInvoice: sales.nextSuggestedInvoice(invoiceNumber) };
    });
  }
  return { create };
}
module.exports = { createSaleService };
