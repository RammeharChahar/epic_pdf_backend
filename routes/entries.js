// backend/routes/entries.js
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// allowed months map (simple validation)
const MONTHS = new Set([
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
]);

/**
 * GET /api/entries/disabled
 * Returns: [{ month, day, created_at, id }, ...] for logged-in user
 * Requires Authorization: Bearer <token>
 */
router.get('/disabled', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
      'SELECT id, month, day, created_at FROM entries WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    // return as plain array: month & day useful for frontend disabling
    res.json(rows.map(r => ({ id: r.id, month: r.month, day: r.day, created_at: r.created_at })));
  } catch (err) {
    console.error('GET /api/entries/disabled error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/entries/my
 * Returns all entries of logged-in user
 */
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      'SELECT id, month, day, form6_count, form8_count, period_start, period_end, remarks, created_at FROM entries WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/entries/my error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/entries/add
 * Body: { month, day, form6, form8, periodStart, periodEnd, remarks }
 * Requires Authorization
 */
// POST /api/entries/add
router.post('/add', auth, async (req, res) => {
  try {
    const user = req.user; // { id, username, role, constituency }
    const {
      month,
      date_of_month,
      form6_count,
      form8_count,
      period_from,
      period_to,
    } = req.body || {};

    console.log(month, date_of_month, form6_count, form8_count, period_from, period_to);

    if (!month || !date_of_month || (form6_count == null) || (form8_count == null) || !period_from || !period_to) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dayNum = Number(date_of_month);
    if (![15, 30].includes(dayNum)) return res.status(400).json({ error: 'Day must be 15 or 30' });

    const f6 = Number(form6_count), f8 = Number(form8_count);
    if (isNaN(f6) || isNaN(f8) || f6 < 0 || f8 < 0) {
      return res.status(400).json({ error: 'Counts must be non-negative numbers' });
    }

    if (new Date(period_from).toString() === 'Invalid Date' || new Date(period_to).toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid period dates' });
    }
    if (new Date(period_from) > new Date(period_to)) {
      return res.status(400).json({ error: 'period_from must be <= period_to' });
    }

    // check duplicate
    const [exists] = await pool.execute(
      'SELECT id FROM entries WHERE user_id = ? AND month = ? AND day = ? LIMIT 1',
      [user.id, month, dayNum]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'You have already submitted for this month & date' });
    }

    const constituency = user.constituency || null;
    const [result] = await pool.execute(
      `INSERT INTO entries (user_id, constituency, month, day, form6_count, form8_count, period_start, period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, constituency, month, dayNum, f6, f8, period_from, period_to]
    );

    res.json({ message: 'Entry saved', entryId: result.insertId, month, day: dayNum });
  } catch (err) {
    console.error('POST /api/entries/add error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
