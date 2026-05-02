const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();

/* ================= START SERVER FIRST (CRITICAL FOR RENDER) ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port " + PORT);
});

/* ================= DATABASE ================= */

/* ================= DATABASE ================= */
let pool = null;

async function initDB() {
  try {
    if (!process.env.MYSQL_URL) {
      console.log("MYSQL_URL not set yet. Waiting...");
      return;
    }

    const url = new URL(process.env.MYSQL_URL);

    pool = mysql.createPool({
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.replace("/", ""),
      port: url.port || 3306,
    });

    console.log("✅ MySQL Connected");
  } catch (err) {
    console.log("DB init error:", err.message);
  }
}

initDB();
/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ================= MIDDLEWARE ================= */

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(session({
  secret: "nardo-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,        // ✅ IMPORTANT for Render
    sameSite: "lax",      // ✅ IMPORTANT
  }
}));

  app.use(express.static(path.join(__dirname, "public")));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "auth", "login.html"));
  });

  app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "auth", "register.html"));
  });
/* ================= AUTH ================= */

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.json({ success: false, message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed]
    );

    res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email=?",
      [email]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.json({ success: false, message: "Wrong password" });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;

    res.json({ success: true, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================= CART ================= */

app.post("/api/cart", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Login first" });
  }

  const { name, price, image } = req.body;

  try {
    await pool.query(
      "INSERT INTO cart (user_id, product_name, price, image, quantity) VALUES (?, ?, ?, ?, 1)",
      [req.session.userId, name, price, image]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/cart", async (req, res) => {
  if (!req.session.userId) return res.json([]);

  try {
    const [rows] = await pool.query(
      "SELECT * FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* ================= CHECKOUT ================= */

app.post("/api/checkout", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "Login first" });
  }

  const { name, email } = req.body;

  try {
    const [items] = await pool.query(
      "SELECT * FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    let total = 0;
    items.forEach((i) => (total += i.price * i.quantity));

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Order Confirmation",
      html: `<h2>Thank you ${name}</h2><p>Total: $${total}</p>`,
    });

    await pool.query("DELETE FROM cart WHERE user_id=?", [
      req.session.userId,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================= PAGES ================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================= START SERVER ================= */
