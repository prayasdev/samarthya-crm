import mongoose from "mongoose";
import UploadDetails from "../models/uploadDetails.js";
import ContactDetails from "../models/contactDetails.js";

/**
 * Returns a MongoDB filter restricting call queries (`customer_id`)
 * to contacts owned by the authenticated user.
 */
export async function getUserCustomerMatch(userId) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [uploads, contacts] = await Promise.all([
    UploadDetails.find({ userId: userObjectId }).select("_id").lean(),
    ContactDetails.find({ userId: userObjectId }).select("_id").lean(),
  ]);
  const ids = [...uploads, ...contacts].map((doc) => doc._id);
  const strIds = ids.map((id) => String(id));
  return { customer_id: { $in: [...ids, ...strIds] } };
}

