// backend/routes/receiveEntries.js
const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// optional: only admin can perform receive updates (recommended)
function ensureAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Requires admin role" });
  next();
}

// helper: month name map for flexible matching
const MONTH_NAME_BY_NUM = {
  "01": "January",
  1: "January",
  "02": "February",
  2: "February",
  "03": "March",
  3: "March",
  "04": "April",
  4: "April",
  "05": "May",
  5: "May",
  "06": "June",
  6: "June",
  "07": "July",
  7: "July",
  "08": "August",
  8: "August",
  "09": "September",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

function buildMonthVariants(monthParam) {
  if (!monthParam) return [];
  const variants = new Set();
  variants.add(monthParam);

  // yyyy-mm
  const mMatch = monthParam.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const mm = mMatch[2];
    const mmNoZero = String(Number(mm));
    variants.add(mm);
    variants.add(mmNoZero);
    const name = MONTH_NAME_BY_NUM[mm];
    if (name) variants.add(name);
    return Array.from(variants);
  }

  // numeric
  const numMatch = monthParam.match(/^(\d{1,2})$/);
  if (numMatch) {
    const mm = numMatch[1].padStart(2, "0");
    variants.add(mm);
    variants.add(String(Number(mm)));
    const name = MONTH_NAME_BY_NUM[mm];
    if (name) variants.add(name);
    return Array.from(variants);
  }

  // assume text month
  const name = monthParam;
  variants.add(name);
  const lower = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  variants.add(lower);
  return Array.from(variants);
}

/**
 * GET /api/receive-entries/:month/:day
 * Fetch entries from `entries` table for given month/day
 * Excludes those already present in `receive_entries`
 */
router.get("/:month/:day", auth, ensureAdmin, async (req, res) => {
  try {
    const { month: monthParam, day } = req.params;
    if (!monthParam || !day) {
      return res.status(400).json({ error: "month and day required" });
    }
    if (!["15", "30"].includes(String(day))) {
      return res.status(400).json({ error: "day must be 15 or 30" });
    }

    // normalize month param for lookup
    const variants = buildMonthVariants(monthParam);
    if (variants.length === 0) return res.json([]);

    const placeholders = variants.map(() => "?").join(",");

    const sql = `
  SELECT e.constituency, e.month, e.day, e.form6_count, e.form8_count
  FROM entries e
  LEFT JOIN receive_entries r
    ON r.constituency = e.constituency
   AND r.month = e.month
   AND r.day = e.day
  WHERE e.day = ?
    AND e.month IN (${placeholders})
    AND r.id IS NULL
  ORDER BY e.constituency ASC
`;
    const params = [Number(day), ...variants];

    const [rows] = await pool.execute(sql, params);

    return res.json(rows);
  } catch (err) {
    console.error("GET /api/receive-entries/:month/:day error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/receive-entries
 * Body: { month, day }
 * Copies rows from `entries` -> `receive_entries`
 * Skips rows already present
 */
router.post("/", auth, ensureAdmin, async (req, res) => {
  try {
    const { month: monthParam, day } = req.body || {};
    if (!monthParam || !day)
      return res.status(400).json({ error: "month and day required" });
    if (![15, 30].includes(Number(day)))
      return res.status(400).json({ error: "day must be 15 or 30" });

    const variants = buildMonthVariants(monthParam);
    if (variants.length === 0)
      return res.status(400).json({ error: "Invalid month" });

    const placeholders = variants.map(() => "?").join(",");
    const selectSql = `
      SELECT constituency, month, day, form6_count, form8_count
      FROM entries
      WHERE day = ?
        AND (month IN (${placeholders}))
      ORDER BY constituency ASC
    `;
    const selectParams = [Number(day), ...variants];
    const [entries] = await pool.execute(selectSql, selectParams);

    if (!entries || entries.length === 0) {
      return res
        .status(404)
        .json({ error: "No entries found for given month/day" });
    }

    const inserted = [];
    const skipped = [];

    for (const e of entries) {
      const monthToSave = e.month;
      const dayToSave = String(e.day);

      const [exists] = await pool.execute(
        `SELECT id FROM receive_entries WHERE constituency = ? AND month = ? AND day = ? LIMIT 1`,
        [e.constituency, monthToSave, dayToSave]
      );
      if (exists.length > 0) {
        skipped.push({
          constituency: e.constituency,
          month: monthToSave,
          day: dayToSave,
        });
        continue;
      }

      const [ins] = await pool.execute(
        `INSERT INTO receive_entries (constituency, month, day, form6_count, form8_count)
         VALUES (?, ?, ?, ?, ?)`,
        [
          e.constituency,
          monthToSave,
          dayToSave,
          e.form6_count || 0,
          e.form8_count || 0,
        ]
      );
      inserted.push({
        id: ins.insertId,
        constituency: e.constituency,
        month: monthToSave,
        day: dayToSave,
      });
    }

    return res.json({
      message: "Receive entries sync completed",
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      inserted,
      skipped,
    });
  } catch (err) {
    console.error("POST /api/receive-entries error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
