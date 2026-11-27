
import mongoose from "mongoose";
import UploadDetails from "../../models/uploadDetails.js";
import CallLiveStatus from "../../models/callLiveStatus.js";
import Calls from "../../models/callHistory.js";
import { getUserCustomerMatch } from "../../helper/userScope.js";

export async function getCallHistory(req, res) {
  try {
    const { limit = 50 } = req.query;
    const customerMatch = req.user?._id ? await getUserCustomerMatch(req.user._id) : {};

    const rows = await CallLiveStatus.aggregate([
      { $match: customerMatch },
      { $sort: { updated_at_iso: -1 } },

      // Get latest update per call
      { $group: { _id: "$call_id", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },

      // Join with UploadDetails (customer info)
      {
        $lookup: {
          from: UploadDetails.collection.name,
          localField: "customer_id",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 0, name: 1, phoneNo: 1 } }],
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      // Join with Calls collection for sentiment and call details
      {
        $lookup: {
          from: Calls.collection.name,
          localField: "call_id",
          foreignField: "call_id",
          pipeline: [{ $project: { _id: 0, sentiment_overall: 1, call_duration_seconds: 1, summary: 1 } }],
          as: "callDoc",
        },
      },
      { $unwind: { path: "$callDoc", preserveNullAndEmptyArrays: true } },

      { $limit: Number(limit) },

      // Final projection
      {
        $project: {
          _id: 0,
          call_id: 1,
          customer_id: 1,
          name: { $ifNull: ["$contact.name", "Unknown"] },
          phoneNo: { $ifNull: ["$contact.phoneNo", "Unknown"] },
          status: "$last_status",
          sentiment: "$callDoc.sentiment_overall", // ensure this matches actual field name
          duration_seconds: { $ifNull: ["$callDoc.call_duration_seconds", 0] },
          summary: "$callDoc.summary",
          updated_at_iso: 1,
        },
      },
    ]);

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("getCallHistory error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}



export async function getCallHistoryByIds(req, res) {
  try {
    let { customerId, callId } = req.params;
    if ((!customerId || !callId) && req.params?.id) {
      const decoded = decodeURIComponent(req.params.id || "");
      const [cid, ccall] = decoded.split(":");
      customerId = customerId || cid;
      callId = callId || ccall;
    }

    if (!customerId || !callId) {
      return res.status(400).json({ success: false, message: "customerId and callId are required" });
    }

    const customerObjectId = mongoose.Types.ObjectId.isValid(customerId)
      ? new mongoose.Types.ObjectId(customerId)
      : null;

    if (!customerObjectId) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    const rows = await CallLiveStatus.aggregate([
      { $match: { customer_id: customerObjectId, call_id: callId } },
      { $sort: { updated_at_iso: -1 } },
      { $limit: 1 },

      // Join with UploadDetails
      {
        $lookup: {
          from: UploadDetails.collection.name,
          localField: "customer_id",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 0, name: 1, phoneNo: 1 } }],
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      // Join with Calls for sentiment and details
      {
        $lookup: {
          from: Calls.collection.name,
          localField: "call_id",
          foreignField: "call_id",
          pipeline: [{ $project: { _id: 0, sentiment_overall: 1, call_duration_seconds: 1, summary: 1 } }],
          as: "callDoc",
        },
      },
      { $unwind: { path: "$callDoc", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 0,
          call_id: 1,
          customer_id: 1,
          name: { $ifNull: ["$contact.name", "Unknown"] },
          phoneNo: { $ifNull: ["$contact.phoneNo", "Unknown"] },
          status: "$last_status",
          sentiment: "$callDoc.sentiment_overall",
          duration_seconds: { $ifNull: ["$callDoc.call_duration_seconds", 0] },
          summary: "$callDoc.summary",
          updated_at_iso: 1,
        },
      },
    ]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error("getCallHistoryByIds error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

