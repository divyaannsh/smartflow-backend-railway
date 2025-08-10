const path = require('path');
const express = require('express');
const app = require('./app');

// Initialize database in background (non-blocking)
console.log('Initializing database in background...');
const { initializeDatabase } = require('./database/init');
initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((error) => {
    console.error('Database initialization failed (non-critical):', error);
  });

// Serve static files from the React app in production (only if build directory exists)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  if (require('fs').existsSync(buildPath)) {
    console.log('Serving static files from client/build');
    app.use(express.static(buildPath));

    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } else {
    console.log('No client/build directory found, running as API-only backend');
  }
}

// Get port from environment variable or default to 5001 (aligns with frontend proxy)
const PORT = process.env.PORT || 5001;

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 