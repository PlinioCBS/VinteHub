require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

const authMiddleware = require('./middleware/authMiddleware');
const authRouter = require('./routes/auth');
const contactsRouter = require('./routes/contacts');
const dealsRouter = require('./routes/deals');
const tasksRouter = require('./routes/tasks');
const clientsRouter = require('./routes/clients');
const calendarRouter = require('./routes/calendar');
const dashboardRouter = require('./routes/dashboard');
const adminUsersRouter = require('./routes/adminUsers');
const financeiroRouter = require('./routes/financeiro');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3001;

// Init DB
initDB();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (mobile, Postman) e origins permitidas
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (photos)
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Public auth routes (no token needed for login)
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/login') return next();
  authMiddleware(req, res, next);
}, authRouter);

// Apply auth middleware to all other /api/* routes
app.use('/api', (req, res, next) => {
  // Skip /api/auth/* entirely (handled above)
  if (req.path.startsWith('/auth')) return next();
  authMiddleware(req, res, next);
});

// Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/financeiro', financeiroRouter);
app.use('/api/products', productsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend (built files)
const frontendDist = path.join(__dirname, 'frontend', 'dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Vinte Brava CRM Backend running on http://localhost:${PORT}`);
});
