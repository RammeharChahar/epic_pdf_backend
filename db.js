// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'neondb_owner',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'neondb',
  ssl: {
    rejectUnauthorized: false, // Required for Neon SSL
  },
  max: 10, // max connections
});

module.exports = pool;
