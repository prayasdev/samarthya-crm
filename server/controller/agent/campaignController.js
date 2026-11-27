// controller/agent/campaignController.js
import mongoose from "mongoose";
import Campaign from "../../models/campaign.js";
import TaskDetails from "../../models/createTask.js";
import UploadDetails from "../../models/uploadDetails.js";
import Counter from "../../models/Counter.js";

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

function toISTIso(dateUtc = new Date()) {
  const istOffsetMinutes = 330; // UTC+5:30
  const istDate = new Date(dateUtc.getTime() + istOffsetMinutes * 60000);
  const tz = "+05:30";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = istDate.getUTCFullYear();
  const mm = pad(istDate.getUTCMonth() + 1);
  const dd = pad(istDate.getUTCDate());
  const hh = pad(istDate.getUTCHours());
  const mi = pad(istDate.getUTCMinutes());
  const ss = pad(istDate.getUTCSeconds());
  const ms = String(istDate.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}${tz}`;
}

async function nextCampaignCode(year) {
  const key = `CMP-${year}`;
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const num = String(doc.seq).padStart(3, "0");
  return `${key}-${num}`;
}

async function resolveTask({ taskId, taskCode }) {
  if (taskCode?.trim()) {
    const t = await TaskDetails.findOne({ taskId: taskCode.trim() });
    if (t) return t;
  }
  if (taskId?.trim() && isValidObjectId(taskId.trim())) {
    const t = await TaskDetails.findById(taskId.trim());
    if (t) return t;
  }
  if (taskId?.trim()) {
    const t = await TaskDetails.findOne({ taskId: taskId.trim() });
    if (t) return t;
  }
  return null;
}

export const createCampaign = async (req, res) => {
  try {
    const {
      campaignName,
      taskId,
      taskCode,
      type,
      category,
      status,
      startedAt,
      messageConfig, 
    } = req.body;

    // Basic validation with clear 400s
    if (!campaignName?.trim()) {
      return res.status(400).json({ success: false, message: "campaignName is required." });
    }
    if (!type || !["call", "message"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'call' or 'message'." });
    }
    if (!category?.trim()) {
      return res.status(400).json({ success: false, message: "category is required." });
    }
    if (status && !["pending", "running", "completed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    // Resolve Task
    const task = await resolveTask({ taskId, taskCode });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found. Provide valid taskId or taskCode." });
    }

    // Fetch users for category
    const uploadedUsers = await UploadDetails.find({ taskId: task._id, category });
    if (!uploadedUsers.length) {
      return res.status(404).json({
        success: false,
        message: `No users found under category '${category}' for this task.`,
      });
    }

    // Sanitize messageConfig if message campaign
    let safeMessageConfig;
    if (type === "message") {
      const ch = (messageConfig && messageConfig.channels) || {};
      // force booleans
      const channels = {
        email: !!ch.email,
        sms: !!ch.sms,
        whatsapp: !!ch.whatsapp,
      };
      const template =
        messageConfig && typeof messageConfig.template === "string"
          ? messageConfig.template
          : "";
      safeMessageConfig = { channels, template };
    }

    // Select up to 30 targeted users
    const targetedUsers = uploadedUsers.slice(0, 30).map((u) => ({
      name: u.name,
      phoneNo: u.phoneNo,
      email: u.email,
      description: u.description,
      category: u.category,
    }));

    const year = new Date().getFullYear();
    const campaignCode = await nextCampaignCode(year);

    const doc = new Campaign({
      campaignId: campaignCode,             // keep legacy unique index satisfied
      campaignCode,                         // preferred human-readable id
      campaignName: campaignName.trim(),
      taskId: task._id,
      taskCode: task.taskId,                // e.g., TSK001
      type,
      category,
      status: status || "running",
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      targetedUsers,
      ...(type === "message" ? { messageConfig: safeMessageConfig } : {}),
    });

    await doc.save();

    return res.status(201).json({
      success: true,
      message: "Campaign created.",
      data: {
        ...doc.toObject(),
        startedAtIst: toISTIso(doc.startedAt),
        createdAtIst: toISTIso(doc.createdAt),
        updatedAtIst: toISTIso(doc.updatedAt),
      },
    });
  } catch (error) {
    console.error("createCampaign Error:", error);
    if (error?.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      // Duplicate key: likely campaignId/campaignCode
      return res.status(409).json({
        success: false,
        message: "Duplicate campaign identifier. Retry creating the campaign.",
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error while creating campaign.",
      error: error.message,
    });
  }
};

export const getid = async (req, res) => {
  try {
    const { id } = req.params; // can be taskCode or ObjectId
    const { category } = req.query;

    const task = await resolveTask({ taskId: id, taskCode: id });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    const uploadData = await UploadDetails.find({ taskId: task._id });
    if (!uploadData.length) {
      return res.status(404).json({ success: false, message: "No uploaded user data found for this Task." });
    }

    const categoryMap = {};
    for (const u of uploadData) {
      if (!categoryMap[u.category]) categoryMap[u.category] = [];
      if (categoryMap[u.category].length < 30) {
        categoryMap[u.category].push({
          name: u.name,
          phoneNo: u.phoneNo,
          email: u.email,
          description: u.description,
          category: u.category,
        });
      }
    }

    if (category) {
      const filtered = categoryMap[category] || [];
      if (!filtered.length) {
        return res.status(404).json({
          success: false,
          message: `No users found under category '${category}' for this task.`,
        });
      }
      return res.status(200).json({
        success: true,
        message: `Users fetched for category '${category}'.`,
        data: {
          taskId: task.taskId,
          fileName: task.fileName,
          category,
          totalUsers: filtered.length,
          users: filtered,
        },
      });
    }

    const categories = Object.entries(categoryMap).map(([cat, users]) => ({
      category: cat,
      totalUsers: users.length,
      users,
    }));

    return res.status(200).json({
      success: true,
      message: "Task data fetched (all categories).",
      data: {
        taskId: task.taskId,
        fileName: task.fileName,
        totalRows: uploadData.length,
        categories,
      },
    });
  } catch (error) {
    console.error("getid Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred.",
      error: error.message,
    });
  }
};
export const retrieveCampaigns = async (req, res) => {
  try {
    const { status, type, category, q } = req.query;

    const filter = {};
    if (req.user?._id) filter.userId = req.user._id;
    if (status) filter.status = status;                // "running" | "pending" | "completed"
    if (type) filter.type = type;                      // "call" | "message"
    if (category) filter.category = category;         // exact category

    // Text-like search on these fields (case-insensitive)
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = [
        { campaignName: rx },
        { campaignId: rx },
        { campaignCode: rx },
        { taskCode: rx },
      ];
    }

    const rows = await Campaign.find(filter).sort({ createdAt: -1 }).lean();

    const istRows = rows.map((c) => ({
      ...c,
      startedAtIst: toISTIso(c.startedAt),
      createdAtIst: toISTIso(c.createdAt),
      updatedAtIst: toISTIso(c.updatedAt),
    }));

    return res.status(200).json({
      success: true,
      message: "Campaigns retrieved.",
      data: istRows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while retrieving campaigns.",
      error: error.message,
    });
  }
};
