// src/controllers/aiCall.controller.js
import Calls from "../../models/callHistory.js";
import CallLiveStatus from "../../models/callLiveStatus.js";
import UploadDetails from "../../models/uploadDetails.js";
import { getUserCustomerMatch } from "../../helper/userScope.js";

// Live monitor: latest per customer, no status filter
export async function getLiveMonitor(req, res) {
  try {
    const { limit = 50 } = req.query;
    const customerMatch = req.user?._id ? await getUserCustomerMatch(req.user._id) : {};

    const rows = await CallLiveStatus.aggregate([
      { $match: customerMatch },
      { $sort: { updated_at_iso: -1 } },

      // Keep only latest per customer
      { $group: { _id: "$customer_id", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },

      // Join UploadDetails.name
      {
        $lookup: {
          from: UploadDetails.collection.name,
          localField: "customer_id",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 0, name: 1 } }],
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      // Join Calls to get duration_seconds by call_id
      {
        $lookup: {
          from: Calls.collection.name,
          localField: "call_id",
          foreignField: "call_id",
          pipeline: [{ $project: { _id: 0, call_duration_seconds: 1 } }],
          as: "callDoc",
        },
      },
      { $unwind: { path: "$callDoc", preserveNullAndEmptyArrays: true } },

      { $limit: Number(limit) },

      {
        $project: {
          _id: 0,
          call_id: 1,
          name: { $ifNull: ["$contact.name", "Unknown"] },
          status: "$last_status",
          duration_seconds: { $ifNull: ["$callDoc.call_duration_seconds", 0] },
          updated_at_iso: 1,
          customer_id: 1,
        },
      },
    ]);

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("Live monitor error:", e.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// Full list with pagination (no total)
export async function fetchAllCalls(req, res) {
  try {
    const {
      page = 1,
      pageSize = 100,
      sort = "updated_at_iso",
      order = "desc",
    } = req.query;

    const p = Math.max(1, Number(page));
    const ps = Math.min(1000, Math.max(1, Number(pageSize)));
    const sortDir = order === "asc" ? 1 : -1;

    const customerMatch = req.user?._id ? await getUserCustomerMatch(req.user._id) : {};

    const pipeline = [
      { $match: customerMatch },
      { $sort: { [sort]: sortDir } },
      { $skip: (p - 1) * ps },
      { $limit: ps },

      {
        $lookup: {
          from: UploadDetails.collection.name,
          localField: "customer_id",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 0, name: 1 } }],
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: Calls.collection.name,
          localField: "call_id",
          foreignField: "call_id",
          pipeline: [{ $project: { _id: 0, call_duration_seconds: 1 } }],
          as: "callDoc",
        },
      },
      { $unwind: { path: "$callDoc", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 0,
          call_id: 1,
          name: { $ifNull: ["$contact.name", "Unknown"] },
          status: "$last_status",
          duration_seconds: { $ifNull: ["$callDoc.call_duration_seconds", 0] },
          updated_at_iso: 1,
        },
      },
    ];

    const items = await CallLiveStatus.aggregate(pipeline);

    return res.json({
      success: true,
      page: p,
      pageSize: ps,
      data: items,
    });
  } catch (e) {
    console.error("fetchAllCalls error:", e.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
