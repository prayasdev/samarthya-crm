import mongoose from "mongoose";


const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    whatsappNo: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "New",
        "Pending",
        "Rejected",
        "Assigned",
        "Imported",
        "Contacted",
        "Interested",
        "No Replay",
        "Engaging",
      ],
      required: true,
    },
    purpose: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const ContactDetails = mongoose.model("ContactDetails", contactSchema);
export default ContactDetails;
