const serverless = require('serverless-http');
const app = require('./app');

// Ensure database is initialized on cold start
const { initializeDatabase } = require('./database/init');
let initialized = false;

async function ensureInit() {
  if (!initialized) {
    try {
      await initializeDatabase();
      initialized = true;
      // eslint-disable-next-line no-console
      console.log('Database initialized (serverless)');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Database initialization failed (serverless):', e);
    }
  }
}

module.exports = async (req, res) => {
  await ensureInit();
  const handler = serverless(app);
  return handler(req, res);
};


