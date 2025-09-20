// routes/reports.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

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

    const sql = `
      SELECT
        id,
        constituency AS constituency_no,
        month AS month_raw,
        MONTH(STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d')) AS month,
        DATE_FORMAT(STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d'), '%M %Y') AS month_label,
        day,
        form6_count,
        form8_count,
        total
      FROM ${table}
      WHERE month LIKE ?
      ORDER BY month_raw, constituency, day
    `;

    const [rows] = await pool.query(sql, [yearLike]);
    console.log(rows);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching reports:", err);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;
