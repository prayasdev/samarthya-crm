// routes/dashboard.js
import express from "express";

import { authMiddleware } from "../../controller/auth/authController.js";
import { getDashboardSummary } from "../../controller/Dashboard/index.js";
import { getCategoryDistribution } from "../../controller/Dashboard/barchat.js";
import { getWeeklyPerformance } from "../../controller/Dashboard/weaklychat.js";

const Dashboard = express.Router();
Dashboard.get("/summary", authMiddleware, getDashboardSummary);
Dashboard.get("/barchat", authMiddleware, getCategoryDistribution);
Dashboard.get("/weaklychat", authMiddleware, getWeeklyPerformance);
export default Dashboard;
