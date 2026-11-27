import mongoose from "mongoose";
import Calls from "../../models/callHistory.js";
import UploadDetails from "../../models/uploadDetails.js";

export async function allLeads(req, res) {
  try {
    const { page = 1, pageSize = 50, order = "desc" } = req.query;
    const p = Math.max(1, Number(page));
    const ps = Math.min(500, Math.max(1, Number(pageSize)));
    const sortDir = String(order).toLowerCase() === "asc" ? 1 : -1;

    const userId = new mongoose.Types.ObjectId(req.user._id);

    const pipeline = [
      { $match: { userId } }, // Only match this user's customers

      // Lookup latest updated call per customer by updatedAt
      {
        $lookup: {
          from: Calls.collection.name,
          let: { uid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$customer_id", "$$uid"] },
                    { $eq: [{ $toString: "$customer_id" }, { $toString: "$$uid" }] },
                  ],
                },
              },
            },
            { $sort: { updatedAt: -1 } }, // Sort by updatedAt for latest changes
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                summary: 1,
                sentiment_overall: 1,
                createdAt: 1,
                call_start_iso: 1,
                call_end_iso: 1,
              },
            },
          ],
          as: "latestCall",
        },
      },

      { $unwind: { path: "$latestCall", preserveNullAndEmptyArrays: true } },

      // Derive call_time (prefer end > start > createdAt)
      {
        $project: {
          _id: 0,
          customer_id: "$_id",
          name: { $ifNull: ["$name", "Unknown"] },
          category: { $ifNull: ["$category", "Unspecified"] },

          summary: "$latestCall.summary",
          sentiment: "$latestCall.sentiment_overall",

          call_time: {
            $let: {
              vars: {
                ct: {
                  $ifNull: [
                    "$latestCall.call_end_iso",
                    { $ifNull: ["$latestCall.call_start_iso", "$latestCall.createdAt"] },
                  ],
                },
              },
              in: "$$ct",
            },
          },

          call_time_sort_key: {
            $let: {
              vars: {
                ct: {
                  $ifNull: [
                    "$latestCall.call_end_iso",
                    { $ifNull: ["$latestCall.call_start_iso", "$latestCall.createdAt"] },
                  ],
                },
              },
              in: "$$ct",
            },
          },
        },
      },

      // Sort by call time
      { $sort: { call_time_sort_key: sortDir } },

      // Add row numbers
      {
        $setWindowFields: {
          sortBy: { call_time_sort_key: sortDir },
          output: { sl_no: { $documentNumber: {} } },
        },
      },

      {
        $project: {
          customer_id: 1,
          sl_no: 1,
          name: 1,
          category: 1,
          summary: 1,
          sentiment: 1,
          call_time: 1,
        },
      },

      // Pagination
      { $skip: (p - 1) * ps },
      { $limit: ps },
    ];

    const rows = await UploadDetails.aggregate(pipeline).allowDiskUse(true);
    return res.json({ success: true, page: p, pageSize: ps, data: rows });
  } catch (error) {
    console.error("allLeads error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
