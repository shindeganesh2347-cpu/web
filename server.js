
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// HTML files are in the repository root
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      success: true,
      message: "KMOS backend and PostgreSQL connected!"
    });
  } catch (error) {
    console.error("Database check failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
});

app.get("/api/designs", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM designs ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Unable to load designs." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`KMOS server running on port ${PORT}`);
});
