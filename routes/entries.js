// backend/routes/entries.js
const express = require('express');
const pool = require('../db'); // PostgreSQL pool
const auth = require('../middleware/auth');

const router = express.Router();

const USER_CONSTITUENCY_MAP = {
  "julana": 34,
  "safidon": 35,
  "jind": 36,
  "uchana": 37,
  "narwana": 38
};

router.post('/add', auth, async (req, res) => {
  try {
    const user = req.user; // { id, username, role }
    const {
      month,
      date_of_month,
      form6_count,
      form8_count,
      period_from,
      period_to
    } = req.body || {};

    if (!month || !date_of_month || form6_count == null || form8_count == null || !period_from || !period_to) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dayNum = Number(date_of_month);
    if (![15, 30].includes(dayNum)) return res.status(400).json({ error: 'Day must be 15 or 30' });

    const f6 = Number(form6_count);
    const f8 = Number(form8_count);
    if (isNaN(f6) || isNaN(f8) || f6 < 0 || f8 < 0) {
      return res.status(400).json({ error: 'Counts must be non-negative numbers' });
    }

    if (new Date(period_from).toString() === 'Invalid Date' || new Date(period_to).toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid period dates' });
    }
    if (new Date(period_from) > new Date(period_to)) {
      return res.status(400).json({ error: 'period_from must be <= period_to' });
    }

    // Map username to constituency (case-insensitive)
    const usernameKey = user.username.toLowerCase();
    const constituency = USER_CONSTITUENCY_MAP[usernameKey];
    if (!constituency) {
      return res.status(400).json({ error: `No constituency mapping found for username '${user.username}'` });
    }

    // check duplicate
    const { rows: exists } = await pool.query(
      'SELECT id FROM entries WHERE user_id = $1 AND month = $2 AND day = $3 LIMIT 1',
      [user.id, month, dayNum]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'You have already submitted for this month & date' });
    }

    // Insert entry
    const { rows } = await pool.query(
      `INSERT INTO entries (user_id, constituency, month, day, form6_count, form8_count, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [user.id, constituency, month, dayNum, f6, f8, period_from, period_to]
    );

    res.json({ message: 'Entry saved', entryId: rows[0].id, month, day: dayNum });

  } catch (err) {
    console.error('POST /api/entries/add error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
