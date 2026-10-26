
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing in Render Environment.");
  process.exit(1);
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

// Serve website files from the repository root.
app.use(express.static(__dirname, { dotfiles: "deny" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

// Create the database table if it doesn't exist.
async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS designs (
      id SERIAL PRIMARY KEY,
      design_no VARCHAR(255) NOT NULL,
      gala_no VARCHAR(255) NOT NULL DEFAULT '',
      colour VARCHAR(255) NOT NULL DEFAULT '',
      total_pcs INTEGER NOT NULL DEFAULT 0 CHECK (total_pcs >= 0),
      damage_pcs INTEGER NOT NULL DEFAULT 0
        CHECK (damage_pcs >= 0 AND damage_pcs <= total_pcs),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      success: true,
      message: "KMOS backend and PostgreSQL connected!"
    });
  } catch (error) {
    console.error("Health check:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
});

// View all designs.
app.get("/api/designs", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM designs ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Load designs:", error.message);
    res.status(500).json({ error: "Unable to load designs." });
  }
});

// Add a design.
app.post("/api/designs", async (req, res) => {
  const body = req.body || {};

  const designNo = body.design_no ?? body.designNo;
  const galaNo = body.gala_no ?? body.galaNo ?? "";
  const colour = body.colour ?? body.color ?? "";
  const total = Number(body.total_pcs ?? body.totalPcs ?? 0);
  const damage = Number(body.damage_pcs ?? body.damagePcs ?? 0);

  if (designNo == null || !String(designNo).trim()) {
    return res.status(400).json({
      error: "Design number is required."
    });
  }

  if (
    !Number.isInteger(total) || total < 0 ||
    !Number.isInteger(damage) || damage < 0 ||
    damage > total
  ) {
    return res.status(400).json({
      error: "Piece counts are invalid. Damage PCS cannot exceed Total PCS."
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO designs
       (design_no, gala_no, colour, total_pcs, damage_pcs)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [String(designNo).trim(), String(galaNo), String(colour), total, damage]
    );

    res.status(201).json({
      success: true,
      message: "Design saved successfully.",
      design: result.rows[0]
    });
  } catch (error) {
    console.error("Save design:", error.message);
    res.status(500).json({
      error: "Unable to save design. Check the server logs."
    });
  }
});

// Edit a design.
app.put("/api/designs/:id", async (req, res) => {
  const body = req.body || {};

  const designNo = body.design_no ?? body.designNo;
  const galaNo = body.gala_no ?? body.galaNo ?? "";
  const colour = body.colour ?? body.color ?? "";
  const total = Number(body.total_pcs ?? body.totalPcs ?? 0);
  const damage = Number(body.damage_pcs ?? body.damagePcs ?? 0);

  if (designNo == null || !String(designNo).trim()) {
    return res.status(400).json({ error: "Design number is required." });
  }

  if (
    !Number.isInteger(total) || total < 0 ||
    !Number.isInteger(damage) || damage < 0 ||
    damage > total
  ) {
    return res.status(400).json({ error: "Invalid piece counts." });
  }

  try {
    const result = await db.query(
      `UPDATE designs SET
       design_no = $1, gala_no = $2, colour = $3,
       total_pcs = $4, damage_pcs = $5
       WHERE id = $6 RETURNING *`,
      [
        String(designNo).trim(),
        String(galaNo),
        String(colour),
        total,
        damage,
        req.params.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Design not found." });
    }

    res.json({
      success: true,
      message: "Design updated successfully.",
      design: result.rows[0]
    });
  } catch (error) {
    console.error("Update design:", error.message);
    res.status(500).json({ error: "Unable to update design." });
  }
});

// Delete a design.
app.delete("/api/designs/:id", async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM designs WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Design not found." });
    }

    res.json({
      success: true,
      message: "Design deleted successfully."
    });
  } catch (error) {
    console.error("Delete design:", error.message);
    res.status(500).json({ error: "Unable to delete design." });
  }
});

async function startServer() {
  try {
    await initializeDatabase();
    await db.query("SELECT 1");

    app.listen(PORT, "0.0.0.0", () => {
      console.log("Neon PostgreSQL connected successfully!");
      console.log(`KMOS server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();

process.on("SIGTERM", async () => {
  await db.end();
  process.exit(0);
});
