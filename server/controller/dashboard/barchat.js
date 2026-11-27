// controller/dashboard/categoryDistribution.js (ESM)
import mongoose from "mongoose";
import UploadDetails from "../../models/uploadDetails.js";

const isValidObjectId = (v) => mongoose.isValidObjectId(String(v || "").trim());


export async function getCategoryDistribution(req, res) {
  try {
    const {
      userId,
      taskId,
      category,
      sinceHours,
      includeOther = "true",
      topN,
    } = req.query;

    // Build base match
    const effectiveUserId = req.user?._id || userId;
    const baseMatch = {};
    if (effectiveUserId && isValidObjectId(effectiveUserId)) baseMatch.userId = new mongoose.Types.ObjectId(String(effectiveUserId));
    if (taskId && isValidObjectId(taskId)) baseMatch.taskId = new mongoose.Types.ObjectId(String(taskId));
    if (category) baseMatch.category = String(category).trim();

    // Optional rolling time window (requires createdAt in your collection)
    if (sinceHours != null && !Number.isNaN(Number(sinceHours))) {
      baseMatch.createdAt = { $gte: new Date(Date.now() - Number(sinceHours) * 3600 * 1000) };
    }

    const pipeline = [
      { $match: baseMatch }, // base filtering [web:329]
      {
        $project: {
          _catRaw: { $ifNull: ["$category", ""] }, // null-safe [web:309]
        },
      },
      {
        $project: {
          key: { $toLower: { $trim: { input: "$_catRaw" } } }, // normalize [web:320]
          display: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: "$_catRaw" } } }, 0] },
              { $trim: { input: "$_catRaw" } },
              "Other",
            ],
          }, // human-friendly label [web:329]
        },
      },
      {
        $group: {
          _id: "$key",
          display: { $first: "$display" },
          count: { $sum: 1 },
        },
      }, // grouped counts [web:323]
      { $sort: { count: -1, display: 1 } },
    ];

    // Execute base grouping
    let grouped = await UploadDetails.aggregate(pipeline);

    // Handle topN bucketing (optional)
    const n = Number(topN);
    if (Number.isFinite(n) && n > 0 && grouped.length > n) {
      const head = grouped.slice(0, n);
      const tail = grouped.slice(n);
      const otherCount = tail.reduce((a, b) => a + (b.count || 0), 0);
      // Merge tail into "Other"
      const existingOtherIdx = head.findIndex((x) => x.display === "Other" || x._id === "");
      if (existingOtherIdx >= 0) {
        head[existingOtherIdx].count += otherCount;
      } else if (otherCount > 0) {
        head.push({ _id: "other", display: "Other", count: otherCount });
      }
      grouped = head;
    }

    // Optionally drop empty categories instead of labeling as "Other"
    if (String(includeOther).toLowerCase() === "false") {
      grouped = grouped.filter((g) => g._id && g._id.length > 0);
    }

    // Compute total and percentages
    const total = grouped.reduce((a, b) => a + (b.count || 0), 0) || 0;
    const series = total === 0
      ? []
      : grouped.map((g) => ({
          name: g.display || "Other",
          value: g.count,                   // Recharts Pie uses value for slice sizing [web:329]
          count: g.count,                   // raw count for tooltips/tables [web:329]

          percent: Number(((g.count / total) ).toFixed(2)), // explicit percent if needed [web:323]
        }));

    return res.status(200).json({
      success: true,
      total,
      series, // feed this to your Pie as categoryData
    }); // JSON response for frontend [web:274]
  } catch (e) {
    console.error("getCategoryDistribution error:", e.message);
    return res.status(500).json({ success: false, message: "Server error", error: e.message });
  }
}
