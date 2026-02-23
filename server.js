// server.js
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "JPR1187",  // your MySQL password
  database: "bank_db"
});

db.connect((err) => {
  if (err) console.error("❌ DB Connection Failed:", err);
  else console.log("✅ Connected to MySQL Database");
});


// ---------------------- REGISTER ----------------------
app.post("/register", (req, res) => {
  const { acc, cif, email, phone, password } = req.body;
  console.log("Incoming registration:", req.body); // <-- Debugging


  if (!acc || !cif || !email || !phone || !password)
    return res.status(400).json({ error: "All fields are required" });

  const sql = `INSERT INTO customers (account_number, cif_number, username, phone, password)
               VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [acc, cif, email, phone, password], (err) => {
    if (err) {
      console.error("❌ Insert error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Customer registered successfully!" });
  });
});


// ---------------------- LOGIN ----------------------
app.post("/login", (req, res) => {
  const { email, password, userType } = req.body;

  if (!email || !password || !userType)
    return res.status(400).json({ error: "All fields are required" });

  if (userType === "Customer") {
    const sql = `SELECT * FROM customers WHERE username = ? AND password = ?`;
    db.query(sql, [email, password], (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (results.length > 0)
        res.json({ message: "Customer login successful!" });
      else res.status(401).json({ error: "Invalid credentials" });
    });
  } else {
    res.status(403).json({ error: `${userType} login not implemented yet.` });
  }
});


// ---------------------- TRANSACTION ----------------------
app.post("/api/transactions", (req, res) => {
  const { fromAcc, toAcc, amount, desc } = req.body;

  if (!fromAcc || !toAcc || !amount)
    return res.json({ success: false, message: "All fields are required!" });

  // Step 1: Verify both accounts exist
  const checkAccounts = `SELECT account_number, balance FROM accounts WHERE account_number IN (?, ?)`;
  db.query(checkAccounts, [fromAcc, toAcc], (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: "Database error" });
    }

    if (result.length < 2)
      return res.json({ success: false, message: "Invalid account numbers!" });

    const sender = result.find(r => r.account_number === fromAcc);
    const receiver = result.find(r => r.account_number === toAcc);

    if (parseFloat(sender.balance) < parseFloat(amount))
      return res.json({ success: false, message: "Insufficient balance!" });

    // Step 2: Start transaction
    db.beginTransaction(err => {
      if (err) throw err;

      // Deduct from sender
      const deduct = `UPDATE accounts SET balance = balance - ? WHERE account_number = ?`;
      db.query(deduct, [amount, fromAcc], (err) => {
        if (err) {
          return db.rollback(() => {
            console.error(err);
            res.json({ success: false, message: "Transaction failed!" });
          });
        }

        // Add to receiver
        const add = `UPDATE accounts SET balance = balance + ? WHERE account_number = ?`;
        db.query(add, [amount, toAcc], (err) => {
          if (err) {
            return db.rollback(() => {
              console.error(err);
              res.json({ success: false, message: "Transaction failed!" });
            });
          }

          // Record transaction
          const record = `INSERT INTO transactions (from_account, to_account, amount, description)
                          VALUES (?, ?, ?, ?)`;
          db.query(record, [fromAcc, toAcc, amount, desc || ''], (err) => {
            if (err) {
              return db.rollback(() => {
                console.error(err);
                res.json({ success: false, message: "Transaction record failed!" });
              });
            }

            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  res.json({ success: false, message: "Commit failed!" });
                });
              }
              res.json({ success: true, message: "Transaction successful!" });
            });
          });
        });
      });
    });
  });
});


// ---------------------- LOAN REQUEST ----------------------
app.post("/api/loans", (req, res) => {
  const { loanType, loanAmount, loanTerm, loanIncome } = req.body;

  if (!loanType || !loanAmount || !loanTerm || !loanIncome)
    return res.json({ success: false, message: "All fields are required!" });

  const sql = `INSERT INTO loans (account_number, loan_type, loan_amount, loan_term_months, monthly_income)
               VALUES (?, ?, ?, ?, ?)`;

  // For demo, assume one logged-in customer (you can modify later)
  const demoAccount = "CUST1001";

  db.query(sql, [demoAccount, loanType, loanAmount, loanTerm, loanIncome], (err) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: "Loan request failed!" });
    }
    res.json({ success: true, message: "Loan request submitted successfully!" });
  });
});


// ---------------------- START SERVER ----------------------
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
