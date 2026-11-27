import mongoose from "mongoose";
import Calls from "../../models/callHistory.js";
import UploadDetails from "../../models/uploadDetails.js";

export async function pendingFollowups(req, res) {
  try {
    const { page = 1, pageSize = 50, order = "desc" } = req.query;
    const p = Math.max(1, Number(page));
    const ps = Math.min(500, Math.max(1, Number(pageSize)));
    const sortDir = String(order).toLowerCase() === "asc" ? 1 : -1;

    // Define the valid live call statuses to filter on
    const validStatuses = ["busy", "no-answer", "failed", "cancel"];
    const userMatch = req.user?._id
      ? { userId: new mongoose.Types.ObjectId(String(req.user._id)) }
      : {};

    const pipeline = [
      { $match: userMatch }, // Only this user's customers

      // Lookup the latest call from Calls collection
      {
        $lookup: {
          from: Calls.collection.name,
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$customer_id", "$$uid"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                sentiment_overall: 1,
                createdAt: 1,
                call_duration_seconds: 1,
                summary: 1,
              },
            },
          ],
          as: "latestCall",
        },
      },
      { $unwind: { path: "$latestCall", preserveNullAndEmptyArrays: false } },

      // Lookup the latest live call status from CallLiveStatus collection
      {
        $lookup: {
          from: "calllivestatuses", // ensure this is the exact collection name
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$customer_id", "$$uid"] } } },
            { $sort: { updated_at_iso: -1 } },
            { $limit: 1 },
            { $project: { last_status: 1 } },
          ],
          as: "latestLiveStatus",
        },
      },
      { $unwind: { path: "$latestLiveStatus", preserveNullAndEmptyArrays: true } },

      // Filter for negative sentiment and valid call statuses
      {
        $match: {
          "latestCall.sentiment_overall": "Negative",
          "latestLiveStatus.last_status": { $in: validStatuses },
        },
      },

      // Project only required fields
      {
        $project: {
          customer_id: "$_id",
          name: 1,
          phoneNo: 1,
          category: 1,
          sentiment: "$latestCall.sentiment_overall",
          call_status: "$latestLiveStatus.last_status",
          call_duration_seconds: "$latestCall.call_duration_seconds",
          call_date: "$latestCall.createdAt",
        },
      },

      // Sort by name and paginate results
      { $sort: { name: sortDir } },
      { $skip: (p - 1) * ps },
      { $limit: ps },
    ];

    const rows = await UploadDetails.aggregate(pipeline).allowDiskUse(true);

    // Log any rows with undefined critical fields for debugging
    rows.forEach((row, idx) => {
      if (
        row.customer_id === undefined ||
        row.name === undefined ||
        row.sentiment === undefined ||
        row.call_status === undefined
      ) {
        console.log(`Undefined fields in row index ${idx}:`, row);
      }
    });

    console.log(`Total pending followups found: ${rows.length}`);

    return res.json({ success: true, page: p, pageSize: ps, data: rows });
  } catch (error) {
    console.error("pendingFollowups error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function pendingFollowupsUsingId(req, res) {
  try {
    const { call_id } = req.params;
    const doc = await Calls.findOne({ call_id }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("getCallDetail error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
