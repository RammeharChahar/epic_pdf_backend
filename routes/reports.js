// routes/reports.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // pg pool

// GET /api/reports?reportType=Receive&year=2025
router.get("/", async (req, res) => {
  try {
    const { reportType, year } = req.query;
    if (!reportType || !year) {
      return res.status(400).json({ error: "Missing reportType or year" });
    }

    // Decide table name
    const table =
      reportType === "Receive" ? "receive_entries" : "distribution_entries";

    // month stored as "YYYY-MM" → filter by LIKE
    const yearLike = `${year}-%`;

    // PostgreSQL version:
    const sql = `
      SELECT
        id,
        constituency AS constituency_no,
        month AS month_raw,
        EXTRACT(MONTH FROM TO_DATE(month || '-01', 'YYYY-MM-DD')) AS month,
        TO_CHAR(TO_DATE(month || '-01', 'YYYY-MM-DD'), 'Month YYYY') AS month_label,
        day,
        form6_count,
        form8_count,
        total
      FROM ${table}
      WHERE month LIKE $1
      ORDER BY month_raw, constituency, day
    `;

    const { rows } = await pool.query(sql, [yearLike]);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching reports:", err);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;
