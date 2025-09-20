// routes/distributionEntries.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // mysql2/promise pool

// ✅ Get entries from receive_entries that are NOT in distribution_entries
router.get("/", async (req, res) => {
  try {
    const [results] = await pool.query(
      `
      SELECT r.*
      FROM receive_entries r
      LEFT JOIN distribution_entries d
        ON r.constituency = d.constituency
       AND r.month = d.month
       AND r.day = d.day
      WHERE d.id IS NULL
      ORDER BY r.month DESC, r.constituency, r.day;
      `
    );
    res.json(results);
  } catch (err) {
    console.error("Error fetching distribution entries:", err);
    res.status(500).json({ error: "Failed to fetch distribution entries" });
  }
});

// ✅ Save a new distribution entry
router.post("/", async (req, res) => {
  try {
    const { constituency, month, day, form6_count, form8_count, total } = req.body;

    await pool.query(
      `
      INSERT INTO distribution_entries 
      (constituency, month, day, form6_count, form8_count, total) 
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [constituency, month, day, form6_count, form8_count, total]
    );

    res.json({ message: "✅ Distribution entry saved!" });
  } catch (err) {
    console.error("Error saving distribution entry:", err);
    res.status(500).json({ error: "Failed to save distribution entry" });
  }
});

module.exports = router;
