// controller/dashboard/summary.js (ESM)
import mongoose from "mongoose";
import Calls from "../../models/callHistory.js";
import CallLiveStatus from "../../models/callLiveStatus.js";
import UploadDetails from "../../models/uploadDetails.js";
import { getUserCustomerMatch } from "../../helper/userScope.js";

const isValidObjectId = (v) => mongoose.isValidObjectId(String(v || "").trim());

export async function getDashboardSummary(req, res) {
  try {
    const { sinceHours, taskId, category } = req.query;
    const userId = req.user?._id || req.query.userId;
    const customerMatch = userId ? await getUserCustomerMatch(userId) : {};

    const timeMatch = {};
    if (sinceHours != null && !Number.isNaN(Number(sinceHours))) {
      timeMatch.updated_at_iso = { $gte: new Date(Date.now() - Number(sinceHours) * 3600 * 1000) };
    }
    const totalCallsPromise = Calls.distinct("call_id", customerMatch).then((ids) => ids.length);

    // Average call time (hours): coerce duration fields to double
    const avgPromise = Calls.aggregate([
      { $match: customerMatch },
      {
        $addFields: {
          _durRaw: { $ifNull: ["$duration_seconds", "$call_duration_seconds"] }, // try both [web:309]
        },
      },
      { $addFields: { _durSec: { $toDouble: { $ifNull: ["$_durRaw", 0] } } } }, // coerce strings to number [web:310]
      { $match: { _durSec: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: "$_durSec" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          avgDurationHours: {
            $cond: [
              { $gt: ["$count", 0] },
              { $divide: [{ $divide: ["$totalDuration", "$count"] }, 3600] },
              0,
            ],
          },
        },
      },
    ]).then((r) => (r.length ? r[0].avgDurationHours : 0)); // [web:329][web:310]

    // Sentiments: normalize case and compute percentages among docs that have sentiment
    const sentimentsPromise = (async () => {
      const base = await Calls.aggregate([
        { $match: customerMatch },
        { $addFields: { _sentRaw: { $ifNull: ["$sentiment", "$sentiment_overall", ""] } } }, // [web:309]
        { $match: { _sentRaw: { $type: "string" } } },
        { $project: { s: { $toLower: "$_sentRaw" } } }, // [web:320]
        { $group: { _id: "$s", count: { $sum: 1 } } }, // [web:323]
      ]);
      const total = base.reduce((a, b) => a + b.count, 0);
      if (!total) return { Positive: 0, Negative: 0, Neutral: 0 };
      const map = Object.fromEntries(base.map((x) => [x._id, x.count]));
      const pct = (n) => Number(((n / total) * 100).toFixed(2));
      return {
        Positive: pct((map["positive"] || 0) + (map["pos"] || 0)),
        Negative: pct((map["negative"] || 0) + (map["neg"] || 0)),
        Neutral: pct(map["neutral"] || 0),
      };
    })(); // [web:320][web:323]

    // Acquired attention: canceled/cancel/busy/no-answer/failed with optional filters
    const statusList = ["canceled", "cancel", "busy", "no-answer", "failed"];
    const liveStatusMatch = { last_status: { $in: statusList }, ...timeMatch, ...customerMatch };
    const attentionPipeline = [
      { $match: liveStatusMatch },
      ...(userId || taskId || category
        ? [
            {
              $lookup: {
                from: UploadDetails.collection.name,
                localField: "customer_id",
                foreignField: "_id",
                as: "customer",
              },
            },
            { $unwind: { path: "$customer", preserveNullAndEmptyArrays: false } },
            {
              $match: {
                ...(userId && isValidObjectId(userId)
                  ? { "customer.userId": new mongoose.Types.ObjectId(String(userId)) }
                  : {}),
                ...(taskId && isValidObjectId(taskId)
                  ? { "customer.taskId": new mongoose.Types.ObjectId(String(taskId)) }
                  : {}),
                ...(category ? { "customer.category": String(category) } : {}),
              },
            },
          ]
        : []),
      { $group: { _id: "$last_status", count: { $sum: 1 } } },
    ]; // [web:274]

    const attentionPromise = CallLiveStatus.aggregate(attentionPipeline).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
      const canceled = (map["canceled"] || 0) + (map["cancel"] || 0);
      const busy = map["busy"] || 0;
      const no_answer = map["no-answer"] || 0;
      const failed = map["failed"] || 0;
      const rejectedOrNoAnswer = busy + no_answer;
      const totalAttention = canceled + busy + no_answer + failed;
      return { canceled, busy, no_answer, failed, rejectedOrNoAnswer, totalAttention };
    }); // [web:329]

    const [totalCalls, avgCallHours, sentiments, acquiredAttention] = await Promise.all([
      totalCallsPromise,
      avgPromise,
      sentimentsPromise,
      attentionPromise,
    ]); // [web:329]

    return res.status(200).json({
      success: true,
      filters: {
        sinceHours: sinceHours ? Number(sinceHours) : null,
        userId: userId || null,
        taskId: taskId || null,
        category: category || null,
      },
      metrics: { totalCalls, avgCallHours, sentiments, acquiredAttention },
    }); // [web:274]
  } catch (e) {
    console.error("getDashboardSummary error:", e.message);
    return res.status(500).json({ success: false, message: "Server error", error: e.message });
  }
}

