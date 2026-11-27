import { processExcelFile } from "../../helper/processxl.js";
import mongoose from "mongoose";
import ContactDetails from "../../models/contactDetails.js";
import UploadDetails from "../../models/uploadDetails.js";
import Calls from "../../models/callHistory.js";

export const handleContactUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const result = await processExcelFile(req.file.path, req.user._id);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.message || "Something went wrong while processing the file",
    });
  }
};


export const addContactDetails = async (req, res) => {
  try {
    const { name, email, phone, whatsappNo, status,purpose } = req.body;

    if (!name || !email || !phone || !whatsappNo || !status || !purpose) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const newContact = new ContactDetails({
      name,
      email,
      phone,
      whatsappNo,
      status,
      purpose,
      userId: req.user._id,
    });

    await newContact.save();

    res.status(201).json({
      success: true,
      message: "Contact added successfully",
      data: newContact,
    });
  } catch (error) {
    console.error("Add contact error:", error);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

export const editList = async (req, res) => {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Contact ID not provided",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid contact ID format" });
    }

    const { name, email, phone, phoneNo, category, description, whatsappNo, status, purpose } = req.body;
    const finalPhone = phoneNo || phone;

    // 1. Check in UploadDetails (the primary contacts collection in CRM)
    const uploadDoc = await UploadDetails.findOne({ _id: id, userId: req.user._id });
    if (uploadDoc) {
      if (name) uploadDoc.name = name.trim();
      if (finalPhone) uploadDoc.phoneNo = finalPhone.trim();
      if (email) uploadDoc.email = email.trim().toLowerCase();
      if (category) uploadDoc.category = category.trim();
      if (description !== undefined) uploadDoc.description = description ? description.trim() : "";

      await uploadDoc.save();
      console.log(`[Contact Edit] Updated UploadDetails contact: ${id} (${uploadDoc.name})`);

      return res.status(200).json({
        success: true,
        message: "Contact updated successfully",
        data: uploadDoc,
      });
    }

    // 2. Fallback check in ContactDetails
    const contactDoc = await ContactDetails.findOne({ _id: id, userId: req.user._id });
    if (contactDoc) {
      if (name) contactDoc.name = name;
      if (email) contactDoc.email = email;
      if (finalPhone) contactDoc.phone = finalPhone;
      if (whatsappNo) contactDoc.whatsappNo = whatsappNo;
      if (status) contactDoc.status = status;
      if (purpose) contactDoc.purpose = purpose;

      await contactDoc.save();
      console.log(`[Contact Edit] Updated ContactDetails contact: ${id} (${contactDoc.name})`);

      return res.status(200).json({
        success: true,
        message: "Contact updated successfully",
        data: contactDoc,
      });
    }

    return res.status(404).json({
      success: false,
      message: "Contact not found",
    });
  } catch (error) {
    console.error("Edit contact error:", error);
    res.status(500).json({ success: false, message: "Error occurred updating contact", error: error.message });
  }
};

export const deleteList = async (req, res) => {
  try {
    const id = req.params.id?.trim();

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Contact ID not provided",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid contact ID format" });
    }

    // 1. Try deleting from UploadDetails
    let deletedContact = await UploadDetails.findOneAndDelete({ _id: id, userId: req.user._id });
    let sourceCollection = "UploadDetails";

    // 2. If not found in UploadDetails, try ContactDetails
    if (!deletedContact) {
      deletedContact = await ContactDetails.findOneAndDelete({ _id: id, userId: req.user._id });
      sourceCollection = "ContactDetails";
    }

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // 3. Delete related call history records
    const deletedCalls = await Calls.deleteMany({ customer_id: id });

    console.log(
      `[Contact Delete] Deleted contact ${id} (${deletedContact.name}) from ${sourceCollection} and ${deletedCalls.deletedCount} call history records.`
    );

    res.status(200).json({
      success: true,
      message: `Contact "${deletedContact.name}" deleted successfully.`,
      id,
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    res.status(500).json({
      success: false,
      message: "Error occurred while deleting contact",
      error: error.message,
    });
  }
};


export const fetchAllContactList = async (req, res) => {
  try {
    const listOfContacts = await ContactDetails.find({ userId: req.user._id });
    res.status(200).json({
      success: true,
      data: listOfContacts,
    });
  } catch (error) {
    console.error("Fetch contacts error:", error);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

export const showcontactDetails=async(req,res)=>{
  try{
    const id=req.params.id.trim();
    const contactList=await ContactDetails.findOne({ _id: id, userId: req.user._id })
    if(!contactList){
      return res.status(400).json({
        success:false,
        message:"Contact not found."
      })
    }
    res.status(200).json({
      success:true,
      data:contactList
    })
  }catch(e){
    console.error("Fetch contacts error:", error);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
}