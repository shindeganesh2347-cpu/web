
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML, CSS, JS files from public folder
app.use(express.static(path.join(__dirname, "public")));

// MySQL database connection
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "kmos_inventory",
    waitForConnections: true,
    connectionLimit: 10
});

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Check backend and database
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({
            success: true,
            message: "KMOS backend and MySQL connected!"
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// Get all designs
app.get("/api/designs", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM designs ORDER BY id DESC"
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to load designs." });
    }
});

// Get one design
app.get("/api/designs/:id", async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT * FROM designs WHERE id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Design not found." });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to load design." });
    }
});

// Add a design
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
            error: "Enter valid piece counts. Damage cannot exceed total."
        });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO designs
            (design_no, gala_no, colour, total_pcs, damage_pcs)
            VALUES (?, ?, ?, ?, ?)`,
            [
                String(design_no).trim(),
                String(gala_no),
                String(colour),
                total,
                damage
            ]
        );

        const [rows] = await db.execute(
            "SELECT * FROM designs WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to save design." });
    }
});

// Update a design
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
            error: "Enter valid piece counts. Damage cannot exceed total."
        });
    }

    try {
        const [result] = await db.execute(
            `UPDATE designs SET
                design_no = ?,
                gala_no = ?,
                colour = ?,
                total_pcs = ?,
                damage_pcs = ?
             WHERE id = ?`,
            [
                String(design_no).trim(),
                String(gala_no),
                String(colour),
                total,
                damage,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            const [rows] = await db.execute(
                "SELECT id FROM designs WHERE id = ?",
                [req.params.id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    error: "Design not found."
                });
            }
        }

        const [rows] = await db.execute(
            "SELECT * FROM designs WHERE id = ?",
            [req.params.id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to update design." });
    }
});

// Delete a design
app.delete("/api/designs/:id", async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM designs WHERE id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Design not found." });
        }

        res.json({
            success: true,
            message: "Design deleted successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to delete design." });
    }
});

// Start server after checking MySQL connection
async function startServer() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL database connected successfully!");
        connection.release();

        app.listen(PORT, () => {
            console.log(`KMOS server running: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MySQL connection error:", error.message);
        process.exit(1);
    }
}

startServer();
