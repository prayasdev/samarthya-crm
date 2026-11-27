// controller/dashboard/weeklychart.js
import Calls from "../../models/callHistory.js";
import { getUserCustomerMatch } from "../../helper/userScope.js";

export async function getWeeklyPerformance(req, res) {
  try {
    const days = Number(req.query.days ?? 7);
    const tz = String(req.query.tz || "UTC");
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ success: false, message: "Invalid days" });
    }

    const customerMatch = req.user?._id ? await getUserCustomerMatch(req.user._id) : {};
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 3600 * 1000);

    const rows = await Calls.aggregate([
      { $match: customerMatch },
      // 1) Coalesce possible timestamp fields
      {
        $addFields: {
          _tsRaw: {
            $ifNull: [
              "$createdAt",
              { $ifNull: [
                "$created_at",
                { $ifNull: [
                  "$created_at_iso",
                  { $ifNull: [
                    "$callStart",
                    { $ifNull: ["$start_time", { $ifNull: ["$updated_at_iso", null] }] }
                  ] }
                ] }
              ] }
            ]
          }
        }
      },
      // 2) Type-aware normalization to a proper Date in _tsDate
      {
        $addFields: {
          _tsDate: {
            $switch: {
              branches: [
                // Already a Date
                { case: { $eq: [{ $type: "$_tsRaw" }, "date"] }, then: "$_tsRaw" },
                // String -> parse to Date
                { case: { $eq: [{ $type: "$_tsRaw" }, "string"] }, then: { $dateFromString: { dateString: "$_tsRaw", onError: null, onNull: null } } },
                // Numbers -> detect seconds vs ms and convert
                {
                  case: { $in: [{ $type: "$_tsRaw" }, ["long","int","double","decimal"]] },
                  then: {
                    $toDate: {
                      $cond: [
                        { $lt: [{ $toLong: "$_tsRaw" }, 1000000000000] }, // < 1e12 => seconds
                        { $multiply: [{ $toLong: "$_tsRaw" }, 1000] },     // seconds -> ms
                        { $toLong: "$_tsRaw" }                              // already ms
                      ]
                    }
                  }
                }
              ],
              default: null
            }
          }
        }
      },
      // 3) Only keep documents with a valid date in the last N days
      { $match: { _tsDate: { $ne: null, $gte: since } } },
      // 4) Group per local day and count
      {
        $group: {
          _id: { $dateToString: { date: "$_tsDate", format: "%Y-%m-%d", timezone: tz } },
          value: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]); // Normalize -> filter -> group by day. [web:129][web:138][web:60]

    // 5) Zero-fill missing days and format labels for the chart
    const toKey = (d) => d.toISOString().slice(0, 10);
    const map = new Map(rows.map(r => [r._id, r.value]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const key = toKey(d);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: tz });
      series.push({ date: label, value: Number(map.get(key) || 0) });
    }

    return res.status(200).json({ success: true, series });
  } catch (e) {
    console.error("getWeeklyPerformance error:", e.message);
    return res.status(500).json({ success: false, message: "Server error", error: e.message });
  }
}
