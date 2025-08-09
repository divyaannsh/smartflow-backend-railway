const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const tasksRoutes = require('./routes/tasks');
const usersRoutes = require('./routes/users');
const notificationsRoutes = require('./routes/notifications');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for production - use default if FRONTEND_URL not set
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL || 'https://jirasoftware.vercel.app',
        'https://jirasoftware.vercel.app',
        'https://jirasoftware-jvwt.vercel.app',
        'https://jirasoftware-5jad.vercel.app',
        'https://smartflowaiai.vercel.app',
        'https://jirasoftware-1ntd.vercel.app',
        'https://smartflow-ai.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug endpoint to check database connection
app.get('/api/debug/db', async (req, res) => {
  try {
    const { getDatabase } = require('./database/init');
    const db = getDatabase();
    if (db) {
      if (typeof db.get === 'function') {
        // SQLite database
        db.get('SELECT 1 as test', (err, row) => {
          if (err) {
            console.error('Database connection test failed:', err);
            res.status(500).json({ error: 'Database connection failed', details: err.message });
          } else {
            res.json({ status: 'Database connected', test: row });
          }
        });
      } else {
        // In-memory storage
        res.json({ status: 'In-memory storage active', test: { test: 1 } });
      }
    } else {
      res.status(500).json({ error: 'Database not initialized' });
    }
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug endpoint failed', details: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);

module.exports = app;


