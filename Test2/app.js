const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { loadOrCreateSessionSecret } = require('./src/config/sessionSecret');
const { openDatabase } = require('./src/db/database');
const { runMigrations } = require('./src/db/migrate');
const { requireAuth, requireAdmin } = require('./src/middleware/auth');
const { requireSameOrigin } = require('./src/middleware/sameOrigin');
const { createProductRepository } = require('./src/repositories/productRepository');
const { createSaleRepository } = require('./src/repositories/saleRepository');
const { createDeliveryRepository } = require('./src/repositories/deliveryRepository');
const { createUserRepository } = require('./src/repositories/userRepository');
const { createInventoryRepository } = require('./src/repositories/inventoryRepository');
const { createReportRepository } = require('./src/repositories/reportRepository');
const { createSaleService } = require('./src/services/saleService');
const { createDeliveryService } = require('./src/services/deliveryService');
const { createInventoryService } = require('./src/services/inventoryService');
const { createUserService } = require('./src/services/userService');
const { createReportService } = require('./src/services/reportService');
const { createSaleController } = require('./src/controllers/saleController');
const { createDeliveryController } = require('./src/controllers/deliveryController');
const { createInventoryController } = require('./src/controllers/inventoryController');
const { createUserController } = require('./src/controllers/userController');
const { createReportController } = require('./src/controllers/reportController');
const { createSaleRoutes } = require('./src/routes/saleRoutes');
const { createDeliveryRoutes } = require('./src/routes/deliveryRoutes');
const { createInventoryRoutes } = require('./src/routes/inventoryRoutes');
const { createUserRoutes } = require('./src/routes/userRoutes');
const { createReportRoutes } = require('./src/routes/reportRoutes');
const { createProductRoutes } = require('./src/routes/productRoutes');
const { createAuthRoutes } = require('./src/routes/authRoutes');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.PHIMS_DATA_DIR || path.join(__dirname, 'data'));
const DB_PATH = path.resolve(process.env.PHIMS_DB_PATH || path.join(DATA_DIR, 'phims.sqlite3'));
const SESSION_SECRET = loadOrCreateSessionSecret(DATA_DIR);
const CLIENT_DIST = path.join(__dirname, 'client', 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = openDatabase(DB_PATH);
runMigrations(db, path.join(__dirname, 'src', 'db', 'migrations'));

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false, // Enable with the final locally bundled React asset list.
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(session({
  name: 'phims.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.get('/api/health', (req, res) => {
  const result = db.prepare('SELECT sqlite_version() AS sqliteVersion').get();
  res.json({ ok: true, database: 'sqlite', sqliteVersion: result.sqliteVersion });
});

app.use('/api', requireSameOrigin);
const productRepository = createProductRepository(db);
const saleRepository = createSaleRepository(db);
const deliveryRepository = createDeliveryRepository(db);
const userRepository = createUserRepository(db);
const inventoryRepository = createInventoryRepository(db);
const reportRepository = createReportRepository(db);
const saleService = createSaleService(db, productRepository, saleRepository);
const saleController = createSaleController(saleService, saleRepository);
const deliveryService = createDeliveryService(db, productRepository, deliveryRepository);
const deliveryController = createDeliveryController(deliveryService);
const inventoryService = createInventoryService(db, inventoryRepository);
const inventoryController = createInventoryController(inventoryService);
const userService = createUserService(db, userRepository);
const userController = createUserController(userService);
const reportService = createReportService(reportRepository);
const reportController = createReportController(reportService);

app.use('/api/auth', createAuthRoutes(userRepository));
app.use('/api/products', requireAuth, createProductRoutes(productRepository));
app.use('/api/sales', requireAuth, createSaleRoutes(saleController));
app.use('/api/deliveries', requireAuth, createDeliveryRoutes(deliveryController));
app.use('/api/inventory', requireAuth, createInventoryRoutes(inventoryController));
app.use('/api/users', requireAuth, requireAdmin, createUserRoutes(userController));
app.use('/api/reports', requireAuth, createReportRoutes(reportController));

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1d' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      'PhIMS backend and SQLite database are running. Build the React client into client/dist.'
    );
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = Number(err.status || 500);
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status >= 500 ? 'An unexpected error occurred.' : err.message,
      ...(err.details ? { details: err.details } : {})
    }
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`PhIMS running at http://127.0.0.1:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, db };
