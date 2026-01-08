/**
 * META TECH HOSTING WEB
 * By Developer Shazam
 */

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = "./data/users.json";

// Ensure folders exist
fs.mkdirSync("./data", { recursive: true });
fs.mkdirSync("./uploads", { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "meta-tech-secret",
  resave: false,
  saveUninitialized: false
}));

// Helper functions
function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Auth middleware
function auth(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  next();
}

function adminOnly(req, res, next) {
  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).send("Admins only");
  }
  next();
}

// Serve frontend
app.use(express.static("public"));

/* =====================
   AUTH ROUTES
===================== */

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (users.find(u => u.username === username)) {
    return res.send("User already exists");
  }

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash, admin: false });
  saveUsers(users);

  res.redirect("/login.html");
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  const user = users.find(u => u.username === username);
  if (!user) return res.send("Invalid login");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.send("Invalid login");

  req.session.user = { username, admin: user.admin };
  res.redirect(user.admin ? "/admin.html" : "/dashboard.html");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});

/* =====================
   FILE UPLOAD / HOSTING
===================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join("uploads", req.session.user.username);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });

// Upload website
app.post("/upload", auth, upload.single("site"), (req, res) => {
  res.send(`
    <h3>Upload Successful</h3>
    <p>Your website is live:</p>
    <a href="/site/${req.session.user.username}" target="_blank">
      Visit Website
    </a><br><br>
    <a href="/dashboard.html">Back to Dashboard</a>
  `);
});

// Serve hosted websites
app.use("/site", express.static(path.join(__dirname, "uploads")));

/* =====================
   ADMIN PANEL
===================== */

app.get("/admin/users", adminOnly, (req, res) => {
  res.json(loadUsers());
});

app.delete("/admin/delete/:user", adminOnly, (req, res) => {
  fs.rmSync(`uploads/${req.params.user}`, { recursive: true, force: true });
  res.send("User site deleted");
});

/* =====================
   DEFAULT ADMIN
===================== */

const users = loadUsers();
if (!users.find(u => u.username === "admin")) {
  users.push({
    username: "admin",
    password: bcrypt.hashSync("admin123", 10),
    admin: true
  });
  saveUsers(users);
}

app.listen(PORT, () =>
  console.log("Meta Tech Hosting Web running on port " + PORT)
);
