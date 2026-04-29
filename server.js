const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ ENV
const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/carwash";
const SECRET = "carwash_secret";

// ✅ MongoDB Connection (SAFE)
mongoose.connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ MongoDB ERROR:", err));

// ✅ Models
const User = mongoose.model("User", {
  email: String,
  password: String,
  role: String
});

const Booking = mongoose.model("Booking", {
  user: String,
  date: String,
  time: String,
  carType: String,
  washType: String,
  instructions: String
});

// ✅ Time slots
const timeSlots = ["10:00","11:00","12:00","1:00","2:00"];

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Backend working 🚗");
});

// ✅ Register
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).send("User already exists");

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashed,
      role: "customer"
    });

    res.send("User created");
  } catch (err) {
    res.status(500).send("Register error");
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("No user");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).send("Wrong password");

    const token = jwt.sign({ email: user.email }, SECRET);

    res.json({ token, role: user.role });
  } catch {
    res.status(500).send("Login error");
  }
});

// ✅ Auth
const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).send("No token");

  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
};

// ✅ Book
app.post("/book", auth, async (req, res) => {
  try {
    const { date, time, carType, washType, instructions } = req.body;

    if (!timeSlots.includes(time)) {
      return res.status(400).send("Invalid time");
    }

    const exists = await Booking.findOne({ date, time });
    if (exists) return res.status(400).send("Time already booked");

    const booking = await Booking.create({
      user: req.user.email,
      date,
      time,
      carType,
      washType,
      instructions
    });

    res.json({ message: "Booked!", booking });
  } catch {
    res.status(500).send("Booking error");
  }
});

// ✅ Get bookings
app.get("/bookings", auth, async (req, res) => {
  try {
    const data = await Booking.find();
    res.json(data);
  } catch {
    res.status(500).send("Error fetching bookings");
  }
});

// ✅ Get slots
app.get("/slots", (req, res) => {
  res.json(timeSlots);
});

// ✅ Create staff (admin only)
app.post("/admin/create-staff", auth, async (req, res) => {
  try {
    if (req.user.email !== "admin@carwash.com") {
      return res.status(403).send("Not allowed");
    }

    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashed,
      role: "staff"
    });

    res.send("Staff created");
  } catch {
    res.status(500).send("Error creating staff");
  }
});

// ✅ Auto-create admin
(async () => {
  try {
    const admin = await User.findOne({ email: "admin@carwash.com" });

    if (!admin) {
      const hashed = await bcrypt.hash("admin123", 10);

      await User.create({
        email: "admin@carwash.com",
        password: hashed,
        role: "admin"
      });

      console.log("✅ Admin created");
    }
  } catch (err) {
    console.log("Admin setup error:", err);
  }
})();

// ✅ Start server
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});