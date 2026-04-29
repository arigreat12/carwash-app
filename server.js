const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const SECRET = "carwash_secret";

// ✅ CONNECT TO MONGODB
mongoose.connect("mongodb://127.0.0.1:27017/carwash");

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
});

mongoose.connection.on("error", (err) => {
  console.log("❌ MongoDB error:", err);
});

// ✅ MODELS
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

// TIME SLOTS
const timeSlots = ["10:00", "11:00", "12:00", "1:00", "2:00"];

// TEST
app.get("/", (req, res) => {
  res.send("Backend working 🚗");
});

// REGISTER (CUSTOMER ONLY)
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    email,
    password: hashed,
    role: "customer"
  });

  res.send("User created");
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).send("No user");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).send("Wrong password");

  const token = jwt.sign({ email }, SECRET);

  res.json({ token, role: user.role });
});

// AUTH MIDDLEWARE
const auth = (req, res, next) => {
  const token = req.headers.authorization;

  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
};

// BOOK APPOINTMENT
app.post("/book", auth, async (req, res) => {
  const { date, time, carType, washType, instructions } = req.body;

  if (!timeSlots.includes(time)) {
    return res.status(400).send("Invalid time slot");
  }

  const exists = await Booking.findOne({ date, time });

  if (exists) {
    return res.status(400).send("Time already booked");
  }

  const booking = await Booking.create({
    user: req.user.email,
    date,
    time,
    carType,
    washType,
    instructions
  });

  res.json({ message: "Booked!", booking });
});

// VIEW BOOKINGS
app.get("/bookings", auth, async (req, res) => {
  const data = await Booking.find();
  res.json(data);
});

// GET SLOTS
app.get("/slots", (req, res) => {
  res.json(timeSlots);
});

// ADMIN CREATE STAFF
app.post("/admin/create-staff", auth, async (req, res) => {
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
});

// 🔑 CREATE ADMIN IF NOT EXISTS
(async () => {
  const adminExists = await User.findOne({ email: "admin@carwash.com" });

  if (!adminExists) {
    const hashed = await bcrypt.hash("admin123", 10);

    await User.create({
      email: "admin@carwash.com",
      password: hashed,
      role: "admin"
    });

    console.log("Admin account created");
  }
})();

// START SERVER
app.listen(5000, () => {
  console.log("Server running on 5000");
});