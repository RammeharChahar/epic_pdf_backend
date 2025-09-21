const express = require("express");
const pool = require("../db"); // pg Pool
const auth = require("../middleware/auth");

const router = express.Router();

function ensureAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Requires admin role" });
  next();
}

const MONTH_NAME_BY_NUM = {
  "01": "January", 1: "January",
  "02": "February", 2: "February",
  "03": "March", 3: "March",
  "04": "April", 4: "April",
  "05": "May", 5: "May",
  "06": "June", 6: "June",
  "07": "July", 7: "July",
  "08": "August", 8: "August",
  "09": "September", 9: "September",
  10: "October", 11: "November", 12: "December",
};

function buildMonthVariants(monthParam) {
  if (!monthParam) return [];
  const variants = new Set();
  variants.add(monthParam);

  const mMatch = monthParam.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const mm = mMatch[2];
    variants.add(mm);
    variants.add(String(Number(mm)));
    const name = MONTH_NAME_BY_NUM[mm];
    if (name) variants.add(name);
    return Array.from(variants);
  }

  const numMatch = monthParam.match(/^(\d{1,2})$/);
  if (numMatch) {
    const mm = numMatch[1].padStart(2, "0");
    variants.add(mm);
    variants.add(String(Number(mm)));
    const name = MONTH_NAME_BY_NUM[mm];
    if (name) variants.add(name);
    return Array.from(variants);
  }

  const name = monthParam;
  variants.add(name);
  variants.add(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
  return Array.from(variants);
}

router.get("/:month/:day", auth, ensureAdmin, async (req, res) => {
  try {
    const { month: monthParam, day } = req.params;
    const dayNum = Number(day);
    if (![15, 30].includes(dayNum)) return res.status(400).json({ error: "day must be 15 or 30" });

    const variants = buildMonthVariants(monthParam);
    if (variants.length === 0) return res.json([]);

    const placeholders = variants.map((_, i) => `$${i + 2}`).join(",");
    const sql = `
      SELECT e.constituency, e.month, e.day, e.form6_count, e.form8_count
      FROM entries e
      LEFT JOIN receive_entries r
        ON r.constituency = e.constituency
       AND r.month = e.month
       AND r.day = e.day
      WHERE e.day = $1::int
        AND e.month IN (${placeholders})
        AND r.id IS NULL
      ORDER BY e.constituency ASC
    `;
    const params = [dayNum, ...variants];
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("GET /api/receive-entries/:month/:day error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, ensureAdmin, async (req, res) => {
  try {
    const { month: monthParam, day } = req.body || {};
    const dayNum = Number(day);
    if (!monthParam || !day) return res.status(400).json({ error: "month and day required" });
    if (![15, 30].includes(dayNum)) return res.status(400).json({ error: "day must be 15 or 30" });

    const variants = buildMonthVariants(monthParam);
    if (variants.length === 0) return res.status(400).json({ error: "Invalid month" });

    const placeholders = variants.map((_, i) => `$${i + 2}`).join(",");
    const selectSql = `
      SELECT constituency, month, day, form6_count, form8_count
      FROM entries
      WHERE day = $1::int AND month IN (${placeholders})
      ORDER BY constituency ASC
    `;
    const selectParams = [dayNum, ...variants];
    const { rows: entries } = await pool.query(selectSql, selectParams);

    if (!entries.length) return res.status(404).json({ error: "No entries found for given month/day" });

    const inserted = [];
    const skipped = [];

    for (const e of entries) {
      const checkSql = `
        SELECT id FROM receive_entries
        WHERE constituency = $1 AND month = $2 AND day = $3::int LIMIT 1
      `;
      const checkParams = [e.constituency, e.month, Number(e.day)];
      const { rows: exists } = await pool.query(checkSql, checkParams);

      if (exists.length > 0) {
        skipped.push({ constituency: e.constituency, month: e.month, day: e.day });
        continue;
      }

      const insertSql = `
        INSERT INTO receive_entries (constituency, month, day, form6_count, form8_count)
        VALUES ($1, $2, $3::int, $4, $5) RETURNING id
      `;
      const insertParams = [e.constituency, e.month, Number(e.day), e.form6_count || 0, e.form8_count || 0];
      const { rows: insRows } = await pool.query(insertSql, insertParams);
      inserted.push({ id: insRows[0].id, constituency: e.constituency, month: e.month, day: e.day });
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
