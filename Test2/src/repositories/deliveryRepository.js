function createDeliveryRepository(db) {
  const findDelivery = db.prepare(`
    SELECT id, invoice_number AS invoiceNumber, delivery_date AS deliveryDate,
           supplier, purpose, remarks
    FROM deliveries
    WHERE invoice_number = ? COLLATE NOCASE AND delivery_date = ?
  `);
  const findPage = db.prepare(`
    SELECT id FROM delivery_pages WHERE delivery_id = ? AND page_number = ?
  `);
  return {
    findDelivery: (invoiceNumber, deliveryDate) => findDelivery.get(invoiceNumber, deliveryDate),
    findPage: (deliveryId, pageNumber) => findPage.get(deliveryId, pageNumber),
    createDelivery(value) {
      return db.prepare(`INSERT INTO deliveries
        (invoice_number, delivery_date, supplier, purpose, remarks, encoded_by_user_id)
        VALUES (@invoiceNumber, @deliveryDate, @supplier, @purpose, @remarks, @userId)`)
        .run(value).lastInsertRowid;
    },
    createPage(value) {
      return db.prepare(`INSERT INTO delivery_pages
        (delivery_id, page_number, page_count, page_total_centavos)
        VALUES (@deliveryId, @pageNumber, @pageCount, @pageTotalCentavos)`)
        .run(value).lastInsertRowid;
    },
    insertItem(value) {
      return db.prepare(`INSERT INTO delivery_items
        (delivery_page_id, product_id, item_name_snapshot, unit_cost_centavos,
         quantity, expiry_date, subtotal_centavos)
        VALUES (@deliveryPageId, @productId, @itemName, @unitCostCentavos,
                @quantity, @expiryDate, @subtotalCentavos)`)
        .run(value).lastInsertRowid;
    },
    incrementStock(productId, quantity) {
      return db.prepare(`UPDATE stock_quantities
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?`).run(quantity, productId);
    },
    updateProductCost(productId, costCentavos, userId) {
      return db.prepare(`UPDATE products
        SET previous_cost_centavos = cost_centavos, cost_centavos = ?,
            changed_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = ?`).run(costCentavos, userId, productId);
    },
    addMovement(value) {
      db.prepare(`INSERT INTO stock_movements
        (product_id, movement_type, quantity_change, stock_before, stock_after,
         delivery_item_id, reason, created_by_user_id)
        VALUES (@productId, @movementType, @quantityChange, @stockBefore, @stockAfter,
                @deliveryItemId, @reason, @userId)`).run(value);
    }
  };
}
module.exports = { createDeliveryRepository };
