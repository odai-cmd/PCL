// test chanes 
const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const mysql = require("mysql2/promise");
const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

/* ================= DATABASE ================= */
const url = new URL(process.env.MYSQL_URL);

const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  port: url.port,
});
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "nardo-secret",
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, "public")));
app.use("/auth", express.static(path.join(__dirname, "auth")));

/* ================= AUTH ================= */

// Register User (FINAL CLEAN VERSION)

app.post("/api/register", async (req, res) => {

  const { name, email, password } = req.body;

  try {

    // Check if email already exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {

      return res.json({
        success: false,
        message: "Email already registered"
      });

    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    res.json({
      success: true,
      message: "Registration successful"
    });

  } catch (err) {

    console.log("REGISTER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});


/// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email=?",
      [email]
    );

    // ❌ USER NOT FOUND
    if (rows.length === 0) {
      return res.json({
        success: false,
        message: "User does not exist. Please register first."
      });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);

    // ❌ WRONG PASSWORD
    if (!ok) {
      return res.json({
        success: false,
        message: "Incorrect password. Please try again."
      });
    }

    // ✅ SUCCESS
    req.session.userId = user.id;
    req.session.userName = user.name;

    res.json({
      success: true,
      message: "Login successful",
      name: user.name
    });

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
// Check session
app.get("/api/me", (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      id: req.session.userId,
      name: req.session.userName
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.get("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* ================= CART ================= */

// Add to cart
// Add to cart
// Add to cart
app.post("/api/cart", async (req, res) => {

  if (!req.session.userId) {

    return res.status(401).json({
      success:false,
      message:"Login first"
    });

  }

  const { name, price, image } = req.body;

  try {

    const [existing] = await pool.query(
      "SELECT * FROM cart WHERE user_id=? AND product_name=?",
      [req.session.userId, name]
    );

    if(existing.length > 0){

      await pool.query(
        "UPDATE cart SET quantity = quantity + 1 WHERE id=?",
        [existing[0].id]
      );

    }
    else{

      await pool.query(
        "INSERT INTO cart (user_id, product_name, price, image, quantity) VALUES (?, ?, ?, ?, 1)",
        [req.session.userId, name, price, image]
      );

    }

    res.json({
      success:true,
      message:"Added to cart"
    });

  }
  catch(err){

    console.log("CART ERROR:", err);

    res.status(500).json({
      success:false
    });

  }

});

// Get cart
app.get("/api/cart", async (req, res) => {
  if (!req.session.userId) return res.json([]);

  const [rows] = await pool.query(
    "SELECT * FROM cart WHERE user_id=?",
    [req.session.userId]
  );

  res.json(rows);
});

// Update quantity
app.put("/api/cart/:id/:action", async (req, res) => {
  const { id, action } = req.params;

  if (action === "plus") {
    await pool.query("UPDATE cart SET quantity = quantity + 1 WHERE id=?", [id]);
  }

  if (action === "minus") {
    await pool.query(
      "UPDATE cart SET quantity = quantity - 1 WHERE id=? AND quantity>1",
      [id]
    );
  }

  res.json({ success: true });
});

// Remove item
app.delete("/api/cart/:id", async (req, res) => {
  await pool.query("DELETE FROM cart WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

/* ================= PAGES ================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "auth", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "auth", "register.html"));
});
// ✅ CHECKOUT (FINAL – matches your form)
app.post("/api/checkout", async (req, res) => {

  if (!req.session.userId) {
    return res.json({
      success: false,
      message: "Please login first"
    });
  }

  const { name, email, phone, address, payment } = req.body;

  try {
    // 1️⃣ Get cart items
    const [cartItems] = await pool.query(
      "SELECT * FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    if (cartItems.length === 0) {
      return res.json({
        success: false,
        message: "Cart is empty"
      });
    }

    // 2️⃣ Calculate total
    let total = 0;
    cartItems.forEach(item => {
      total += item.price * item.quantity;
    });

    // 3️⃣ Save order with customer details

    await pool.query(
  `INSERT INTO orders 
  (user_id, items, total, payment_method, status) 
  VALUES (?, ?, ?, ?, ?)`,
  [
    req.session.userId,
    JSON.stringify({
      customer: { name, email, phone, address },
      products: cartItems.map(item => ({
        product_id: item.product_id || item.id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      }))
    }),
    total,
    payment,
    "Placed"
  ]
);
    // 📧 Send order confirmation email
    await transporter.sendMail({
      from: "yourgmail@gmail.com",
      to: email,
      subject: "NARDO Order Confirmation",
      html: `
        <h2>Thank you for your order, ${name}!</h2>
        <p>Your order has been placed successfully.</p>
        <p><b>Total:</b> $${total}</p>
        <p><b>Payment Method:</b> ${payment}</p>
        <p>We will notify you when it is shipped.</p>
      `
    });

    // 4️⃣ Clear cart
    await pool.query(
      "DELETE FROM cart WHERE user_id=?",
      [req.session.userId]
    );

    res.json({
      success: true,
      message: "✅ Order placed successfully!"
    });

  } catch (err) {
    console.log("CHECKOUT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
/* ================= START ================= */
/* ================= SUBMISSIONS ================= */

// Save submission
app.post("/api/submissions", async (req, res) => {

  try {

    const { type, name, email, message, product, finish, texture, submittedAt } = req.body;

    await pool.query(
      `INSERT INTO submissions
      (type, name, email, message, product, finish, texture, submittedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, name, email, message, product, finish, texture, submittedAt]
    );

    res.json({ success: true });

  } catch (err) {

    console.log("SUBMISSION ERROR:", err);

    res.status(500).json({ success: false });

  }

});


// Get submissions
app.get("/api/submissions", async (req, res) => {

  const [rows] = await pool.query(
    "SELECT * FROM submissions ORDER BY submittedAt DESC"
  );

  res.json(rows);

});


// Delete submissions
app.delete("/api/submissions", async (req, res) => {

  await pool.query("DELETE FROM submissions");

  res.json({ success: true });

});




app.listen(PORT, () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
});

// Get logged in user profile
app.get("/api/profile", async (req, res) => {

  if (!req.session.userId) {
    return res.status(401).json({ success:false });
  }

  const [rows] = await pool.query(
    "SELECT id, name, email FROM users WHERE id=?",
    [req.session.userId]
  );

  res.json(rows[0]);

});

// ✅ ADMIN - GET ALL ORDERS
app.get("/api/admin/orders", async (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/admin/update-status", async (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { id, status } = req.body;

  await pool.query(
    "UPDATE orders SET status=? WHERE id=?",
    [status, id]
  );

  res.json({ message: "Updated" });
});