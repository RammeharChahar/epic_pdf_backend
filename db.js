// backend/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'epicuser',
  password: process.env.DB_PASS || 'epic_pass',
  database: process.env.DB_NAME || 'election_app',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
