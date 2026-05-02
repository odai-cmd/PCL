const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= DATABASE ================= */
if (!process.env.MYSQL_URL) {
  console.error("MYSQL_URL is not set!");
  process.exit(1);
}

const url = new URL(process.env.MYSQL_URL);

const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  port: url.port,
});

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/auth", express.static(path.join(__dirname, "auth")));

app.use(session({
  secret: "nardo-secret",
  resave: false,
  saveUninitialized: false
}));

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
    console.log(err);
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

    if (rows.length === 0)
      return res.json({ success: false, message: "User not found" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok)
      return res.json({ success: false, message: "Wrong password" });

    req.session.userId = user.id;
    req.session.userName = user.name;

    res.json({ success: true, name: user.name });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ================= CART ================= */
app.post("/api/cart", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ message: "Login first" });

  const { name, price, image } = req.body;

  try {
    await pool.query(
      "INSERT INTO cart (user_id, product_name, price, image, quantity) VALUES (?, ?, ?, ?, 1)",
      [req.session.userId, name, price, image]
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/cart", async (req, res) => {
  if (!req.session.userId) return res.json([]);

  const [rows] = await pool.query(
    "SELECT * FROM cart WHERE user_id=?",
    [req.session.userId]
  );

  res.json(rows);
});

/* ================= CHECKOUT ================= */
app.post("/api/checkout", async (req, res) => {
  if (!req.session.userId)
    return res.json({ success: false, message: "Login first" });

  const { name, email, payment } = req.body;

  try {
    const [items] = await pool.query(
      "SELECT * FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    let total = 0;
    items.forEach(i => total += i.price * i.quantity);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Order Confirmation",
      html: `<h2>Thank you ${name}</h2><p>Total: $${total}</p>`
    });

    await pool.query(
      "DELETE FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
});

/* ================= PAGES ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
});