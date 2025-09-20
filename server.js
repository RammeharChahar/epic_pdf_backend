// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const entriesRoutes = require('./routes/entries');
const receiveEntriesRoutes = require("./routes/receiveEntries");
const distributionEntriesRoutes = require("./routes/distributionEntries");
const reportsRouter = require("./routes/reports");


const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use("/api/receive-entries", receiveEntriesRoutes);
app.use("/api/distribution-entries", distributionEntriesRoutes);
app.use("/api/reports", reportsRouter);


// health
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
