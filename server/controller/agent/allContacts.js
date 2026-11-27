import mongoose from "mongoose";
import UploadDetails from "../../models/uploadDetails.js";


export const fetchAllContacts=async(req,res)=>{
  try{
    const allConcats = await UploadDetails.find({ userId: req.user._id });
    res.status(200).json({
      success:true,
      data:allConcats
    })
  }catch(e){
    console.log("Fetch contact error",e);
    res.status(500).json({success:false,message:"Error Occured"})
  }
}

// Get one by id
export const getUploadDetail = async (req, res) => {
  try {
    const id = (req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const doc = await UploadDetails.findOne({ _id: id, userId: req.user._id })
      .select("name email phoneNo category description userId taskId createdAt updatedAt")
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({ success: true, data: doc });
  } catch (err) {
    console.error("getUploadDetail error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


