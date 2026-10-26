
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is missing.");
    process.exit(1);
}

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function initializeDatabase() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS designs (
            id SERIAL PRIMARY KEY,
            design_no VARCHAR(255) NOT NULL,
            gala_no VARCHAR(255) NOT NULL DEFAULT '',
            colour VARCHAR(255) NOT NULL DEFAULT '',
            total_pcs INTEGER NOT NULL DEFAULT 0
                CHECK (total_pcs >= 0),
            damage_pcs INTEGER NOT NULL DEFAULT 0
                CHECK (damage_pcs >= 0 AND damage_pcs <= total_pcs),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({
            success: true,
            message: "KMOS backend and PostgreSQL connected!"
        });
    } catch (error) {
        console.error("Health check failed:", error.message);
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
        console.error("Get designs failed:", error.message);
        res.status(500).json({ error: "Unable to load designs." });
    }
});

app.get("/api/designs/:id", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM designs WHERE id = $1",
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: "Design not found." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get design failed:", error.message);
        res.status(500).json({ error: "Unable to load design." });
    }
});

app.post("/api/designs", async (req, res) => {
    const {
        design_no,
        gala_no = "",
        colour = "",
        total_pcs = 0,
        damage_pcs = 0
    } = req.body;

    if (!design_no || !String(design_no).trim()) {
        return res.status(400).json({
            error: "Design number is required."
        });
    }

    const total = Number(total_pcs);
    const damage = Number(damage_pcs);

    if (
        !Number.isInteger(total) || total < 0 ||
        !Number.isInteger(damage) || damage < 0 ||
        damage > total
    ) {
        return res.status(400).json({
            error: "Invalid piece counts. Damage cannot exceed total."
        });
    }

    try {
        const result = await db.query(
            `INSERT INTO designs
             (design_no, gala_no, colour, total_pcs, damage_pcs)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                String(design_no).trim(),
                String(gala_no),
                String(colour),
                total,
                damage
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Add design failed:", error.message);
        res.status(500).json({ error: "Unable to save design." });
    }
});

app.put("/api/designs/:id", async (req, res) => {
    const {
        design_no,
        gala_no = "",
        colour = "",
        total_pcs = 0,
        damage_pcs = 0
    } = req.body;

    if (!design_no || !String(design_no).trim()) {
        return res.status(400).json({
            error: "Design number is required."
        });
    }

    const total = Number(total_pcs);
    const damage = Number(damage_pcs);

    if (
        !Number.isInteger(total) || total < 0 ||
        !Number.isInteger(damage) || damage < 0 ||
        damage > total
    ) {
        return res.status(400).json({
            error: "Invalid piece counts. Damage cannot exceed total."
        });
    }

    try {
        const result = await db.query(
            `UPDATE designs SET
                design_no = $1,
                gala_no = $2,
                colour = $3,
                total_pcs = $4,
                damage_pcs = $5
             WHERE id = $6
             RETURNING *`,
            [
                String(design_no).trim(),
                String(gala_no),
                String(colour),
                total,
                damage,
                req.params.id
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: "Design not found." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Update design failed:", error.message);
        res.status(500).json({ error: "Unable to update design." });
    }
});

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
        console.error("Delete design failed:", error.message);
        res.status(500).json({ error: "Unable to delete design." });
    }
});

async function startServer() {
    try {
        await initializeDatabase();
        await db.query("SELECT 1");

        console.log("Neon PostgreSQL connected successfully!");

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`KMOS server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Database startup error:", error.message);
        process.exit(1);
    }
}

startServer();

process.on("SIGTERM", async () => {
    await db.end();
    process.exit(0);
});
