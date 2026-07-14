function createReportRepository(db) {
  const period = {
    daily: "date_value",
    weekly: "strftime('%Y-W%W', date_value)",
    monthly: "strftime('%Y-%m', date_value)",
    yearly: "strftime('%Y', date_value)"
  };
  function periodExpression(aggregate) { return period[aggregate]; }

  return {
    sales(start, end, aggregate) {
      const p = periodExpression(aggregate);
      return db.prepare(`WITH source AS (
        SELECT s.id, s.sale_date AS date_value, s.gross_total_centavos,
               s.discount_total_centavos, s.net_total_centavos,
               COALESCE(SUM(si.quantity),0) AS quantity
        FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
        WHERE s.sale_date BETWEEN ? AND ? GROUP BY s.id
      ) SELECT ${p} AS periodKey, MIN(date_value) AS periodStart, MAX(date_value) AS periodEnd,
          COUNT(*) AS totalInvoices, SUM(quantity) AS totalQuantitySold,
          SUM(gross_total_centavos) AS grossSalesCentavos,
          SUM(discount_total_centavos) AS totalDiscountsCentavos,
          SUM(net_total_centavos) AS netSalesCentavos
        FROM source GROUP BY ${p} ORDER BY MIN(date_value)`).all(start,end);
    },
    profit(start, end, aggregate) {
      const p = periodExpression(aggregate);
      return db.prepare(`WITH source AS (
        SELECT s.id, s.sale_date AS date_value, s.gross_total_centavos,
               s.discount_total_centavos, s.net_total_centavos,
               COALESCE(SUM(si.quantity),0) AS quantity,
               COALESCE(SUM(si.quantity * si.unit_cost_centavos),0) AS cost
        FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
        WHERE s.sale_date BETWEEN ? AND ? GROUP BY s.id
      ) SELECT ${p} AS periodKey, MIN(date_value) AS periodStart, MAX(date_value) AS periodEnd,
          COUNT(*) AS totalInvoices, SUM(quantity) AS totalQuantitySold,
          SUM(cost) AS totalCostCentavos, SUM(gross_total_centavos) AS grossSalesCentavos,
          SUM(discount_total_centavos) AS totalDiscountsCentavos,
          SUM(net_total_centavos - cost) AS grossProfitCentavos
        FROM source GROUP BY ${p} ORDER BY MIN(date_value)`).all(start,end);
    },
    deliveries(start,end) {
      return db.prepare(`SELECT di.product_id AS itemId, di.item_name_snapshot AS itemName,
        SUM(di.quantity) AS totalQuantity, SUM(di.subtotal_centavos) AS totalCostCentavos
        FROM delivery_items di JOIN delivery_pages dp ON dp.id=di.delivery_page_id
        JOIN deliveries d ON d.id=dp.delivery_id
        WHERE d.delivery_date BETWEEN ? AND ?
        GROUP BY di.product_id, di.item_name_snapshot ORDER BY totalQuantity DESC`).all(start,end);
    },
    itemPerformance(start,end) {
      return db.prepare(`SELECT si.product_id AS itemId, si.item_name_snapshot AS itemName,
        SUM(si.quantity) AS totalQuantitySold,
        SUM(si.gross_subtotal_centavos) AS grossSalesCentavos,
        SUM(si.discount_amount_centavos) AS totalDiscountsCentavos,
        SUM(si.net_subtotal_centavos) AS netSalesCentavos
        FROM sale_items si JOIN sales s ON s.id=si.sale_id
        WHERE s.sale_date BETWEEN ? AND ?
        GROUP BY si.product_id, si.item_name_snapshot ORDER BY totalQuantitySold DESC`).all(start,end);
    },
    stockCard(start,end) {
      return db.prepare(`SELECT sm.product_id AS itemId, p.item_name AS itemName,
        date(sm.created_at,'localtime') AS movementDate, sm.movement_type AS movementType,
        SUM(sm.quantity_change) AS quantity
        FROM stock_movements sm JOIN products p ON p.item_id=sm.product_id
        WHERE date(sm.created_at,'localtime') BETWEEN ? AND ?
        GROUP BY sm.product_id, p.item_name, date(sm.created_at,'localtime'), sm.movement_type
        ORDER BY p.item_name COLLATE NOCASE, movementDate DESC, movementType`).all(start,end);
    },
    agingDeliveries() {
      return db.prepare(`SELECT di.product_id AS itemId, p.item_name AS itemName,
        CAST(julianday(date('now','localtime')) - julianday(d.delivery_date) AS INTEGER) AS ageDays,
        SUM(di.quantity) AS quantity
        FROM delivery_items di JOIN delivery_pages dp ON dp.id=di.delivery_page_id
        JOIN deliveries d ON d.id=dp.delivery_id JOIN products p ON p.item_id=di.product_id
        GROUP BY di.product_id, p.item_name, d.delivery_date`).all();
    },
    inventory() {
      return db.prepare(`SELECT p.item_id AS itemId,p.item_name AS itemName,s.quantity
        FROM products p JOIN stock_quantities s ON s.product_id=p.item_id`).all();
    },
    optimalOrders() {
      return db.prepare(`WITH demand AS (
        SELECT si.product_id, SUM(si.quantity) qty, MIN(s.sale_date) min_date, MAX(s.sale_date) max_date
        FROM sale_items si JOIN sales s ON s.id=si.sale_id
        WHERE s.sale_date BETWEEN date('now','localtime','-1 year') AND date('now','localtime')
        GROUP BY si.product_id
      ) SELECT p.item_id AS itemId,p.item_name AS itemName,sq.quantity AS currentStock,
        d.qty, CAST(julianday(d.max_date)-julianday(d.min_date)+1 AS REAL) AS days
        FROM demand d JOIN products p ON p.item_id=d.product_id
        JOIN stock_quantities sq ON sq.product_id=d.product_id`).all();
    },
    saleRecords() {
      return db.prepare(`SELECT s.invoice_number AS invoiceNumber,s.sale_date AS date,
        si.product_id AS itemId,si.item_name_snapshot AS itemName,
        si.unit_price_centavos AS priceCentavos,si.quantity,
        si.discount_percent_basis_points AS discountPercentBasisPoints,
        si.is_discounted AS isDiscounted,si.discount_remarks AS discountRemarks,
        si.net_subtotal_centavos AS itemSubtotalCentavos,s.net_total_centavos AS saleTotalCentavos,
        u.name AS encoder
        FROM sales s JOIN sale_items si ON si.sale_id=s.id
        LEFT JOIN users u ON u.id=s.encoded_by_user_id
        ORDER BY s.sale_date DESC,s.id DESC,si.id`).all();
    },
    deliveryRecords() {
      return db.prepare(`SELECT d.invoice_number AS invoiceNumber,dp.page_number AS invoicePage,
        d.delivery_date AS date,di.product_id AS itemId,di.item_name_snapshot AS itemName,
        di.unit_cost_centavos AS costCentavos,di.quantity,di.expiry_date AS expiryDate,
        di.subtotal_centavos AS itemSubtotalCentavos,dp.page_total_centavos AS pageTotalCentavos,
        d.encoded_at AS encodedAt,u.name AS encoder,d.supplier,d.purpose,d.remarks
        FROM deliveries d JOIN delivery_pages dp ON dp.delivery_id=d.id
        JOIN delivery_items di ON di.delivery_page_id=dp.id
        LEFT JOIN users u ON u.id=d.encoded_by_user_id
        ORDER BY d.delivery_date DESC,d.id DESC,dp.page_number,di.id`).all();
    }
  };
}
module.exports={createReportRepository};
