function createInventoryRepository(db) {
  return {
    list() {
      return db.prepare(`
        SELECT p.item_id AS itemId, p.item_name AS itemName,
               p.is_perishable AS isPerishable, s.quantity,
               p.price_centavos AS priceCentavos, p.cost_centavos AS costCentavos,
               (p.price_centavos - p.cost_centavos) AS markupCentavos,
               CASE WHEN p.cost_centavos = 0 THEN NULL
                    ELSE ROUND((p.price_centavos - p.cost_centavos) * 10000.0 / p.cost_centavos)
               END AS markupPercentBasisPoints,
               p.is_active AS isActive, p.updated_at AS updatedAt
        FROM products p
        JOIN stock_quantities s ON s.product_id = p.item_id
        ORDER BY s.quantity DESC, p.item_name COLLATE NOCASE
      `).all();
    },
    findById(itemId) {
      return db.prepare(`SELECT item_id AS itemId, item_name AS itemName,
        price_centavos AS priceCentavos, cost_centavos AS costCentavos,
        is_perishable AS isPerishable, is_active AS isActive
        FROM products WHERE item_id = ? COLLATE NOCASE`).get(itemId);
    },
    findByName(itemName) {
      return db.prepare('SELECT item_id AS itemId FROM products WHERE item_name = ? COLLATE NOCASE').get(itemName);
    },
    create(value) {
      db.prepare(`INSERT INTO products
        (item_id, item_name, price_centavos, cost_centavos,
         previous_price_centavos, previous_cost_centavos, is_perishable,
         changed_by_user_id)
        VALUES (@itemId, @itemName, @priceCentavos, @costCentavos,
                @priceCentavos, @costCentavos, @isPerishable, @userId)`).run(value);
      return this.findById(value.itemId);
    },
    updatePriceAndCost(value) {
      const result = db.prepare(`UPDATE products
        SET previous_price_centavos = price_centavos,
            previous_cost_centavos = cost_centavos,
            price_centavos = @priceCentavos,
            cost_centavos = @costCentavos,
            changed_by_user_id = @userId,
            updated_at = CURRENT_TIMESTAMP
        WHERE item_id = @itemId COLLATE NOCASE`).run(value);
      return result.changes ? this.findById(value.itemId) : null;
    }
  };
}
module.exports = { createInventoryRepository };
