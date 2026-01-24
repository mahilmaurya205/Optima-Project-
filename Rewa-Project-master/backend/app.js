require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const receptionRoutes = require("./routes/reception");
const stockRoutes = require("./routes/stock");
const dispatchRoutes = require("./routes/dispatch");
const marketingRoutes = require("./routes/marketing");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const initCronJobs = require("./config/cronJobs");

const app = express();
initCronJobs();

const uploadDir = path.join(__dirname, "uploads/profile-photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/",(req,res)=>{
  return res.status(200).send("Server is running completely fine")
})

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/reception", receptionRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/marketing", marketingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT,()=>{
  console.log(`server is running on ${PORT}`)
})
// module.exports = app;
