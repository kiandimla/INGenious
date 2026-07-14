function createProductRepository(db) {
  const availableStatement = db.prepare(`
    SELECT p.item_id AS itemId, p.item_name AS itemName,
           p.price_centavos AS priceCentavos, p.cost_centavos AS costCentavos,
           p.is_exempt AS isExempt, p.is_perishable AS isPerishable,
           p.vat_rate_basis_points AS vatRateBasisPoints,
           s.quantity
    FROM products p
    JOIN stock_quantities s ON s.product_id = p.item_id
    WHERE p.is_active = 1 AND s.quantity > 0
    ORDER BY p.item_name COLLATE NOCASE
  `);
  const byIdsStatement = db.prepare(`
    SELECT p.item_id AS itemId, p.item_name AS itemName,
           p.price_centavos AS priceCentavos, p.cost_centavos AS costCentavos,
           p.is_exempt AS isExempt, p.is_perishable AS isPerishable,
           p.vat_rate_basis_points AS vatRateBasisPoints,
           s.quantity
    FROM products p
    JOIN stock_quantities s ON s.product_id = p.item_id
    WHERE p.is_active = 1 AND p.item_id IN (SELECT value FROM json_each(?))
  `);
  return {
    listAvailable: () => availableStatement.all(),
    findActiveByIds: ids => byIdsStatement.all(JSON.stringify(ids))
  };
}
module.exports = { createProductRepository };
