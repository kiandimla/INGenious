function createSaleRepository(db) {
  const findByInvoiceStatement = db.prepare(`
    SELECT *
    FROM sales
    WHERE invoice_number = ? COLLATE NOCASE
  `);

  const createSaleStatement = db.prepare(`
    INSERT INTO sales (
      invoice_number,
      sale_date,
      gross_total_centavos,
      discount_total_centavos,
      vat_total_centavos,
      net_total_centavos,
      encoded_by_user_id
    )
    VALUES (
      @invoiceNumber,
      @saleDate,
      @grossTotalCentavos,
      @discountTotalCentavos,
      @vatTotalCentavos,
      @netTotalCentavos,
      @userId
    )
  `);

  const insertItemStatement = db.prepare(`
    INSERT INTO sale_items (
      sale_id,
      product_id,
      item_name_snapshot,
      unit_price_centavos,
      unit_cost_centavos,
      quantity,
      discount_percent_basis_points,
      is_discounted,
      discount_remarks,
      gross_subtotal_centavos,
      discount_amount_centavos,
      vat_amount_centavos,
      net_subtotal_centavos
    )
    VALUES (
      @saleId,
      @productId,
      @itemName,
      @unitPriceCentavos,
      @unitCostCentavos,
      @quantity,
      @discountBasisPoints,
      @isDiscounted,
      @discountRemarks,
      @grossSubtotalCentavos,
      @discountAmountCentavos,
      @vatAmountCentavos,
      @netSubtotalCentavos
    )
  `);

  const decrementStockStatement = db.prepare(`
    UPDATE stock_quantities
    SET
      quantity = quantity - ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
      AND quantity >= ?
  `);

  const addMovementStatement = db.prepare(`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity_change,
      stock_before,
      stock_after,
      sale_item_id,
      reason,
      created_by_user_id
    )
    VALUES (
      @productId,
      'SALE',
      @quantityChange,
      @stockBefore,
      @stockAfter,
      @saleItemId,
      @reason,
      @userId
    )
  `);

  const latestNumericInvoiceStatement = db.prepare(`
    SELECT invoice_number AS invoiceNumber
    FROM sales
    WHERE invoice_number <> ''
      AND invoice_number NOT GLOB '*[^0-9]*'
    ORDER BY
      CAST(invoice_number AS INTEGER) DESC,
      LENGTH(invoice_number) DESC
    LIMIT 1
  `);

  function incrementNumericInvoice(invoiceNumber) {
    if (!invoiceNumber || !/^\d+$/.test(invoiceNumber)) {
      return "1";
    }

    const width = invoiceNumber.length;
    const nextValue = BigInt(invoiceNumber) + 1n;

    return nextValue.toString().padStart(width, "0");
  }

  return {
    findByInvoice(invoiceNumber) {
      return findByInvoiceStatement.get(invoiceNumber);
    },

    getNextInvoiceNumber() {
      const latest = latestNumericInvoiceStatement.get();

      if (!latest) {
        return "1";
      }

      return incrementNumericInvoice(latest.invoiceNumber);
    },

    createSale(value) {
      return createSaleStatement.run(value).lastInsertRowid;
    },

    insertItem(value) {
      return insertItemStatement.run(value).lastInsertRowid;
    },

    decrementStock(productId, quantity) {
      return decrementStockStatement.run(
        quantity,
        productId,
        quantity
      );
    },

    addMovement(value) {
      addMovementStatement.run(value);
    },

    nextSuggestedInvoice(invoiceNumber) {
      return incrementNumericInvoice(invoiceNumber);
    }
  };
}

module.exports = {
  createSaleRepository
};