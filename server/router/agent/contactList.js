// router/agent/contactList.js
import express from "express";
import twilio from "twilio";
import { upload } from "../../helper/uploadxls.js";
import {
  handleContactUpload,
  addContactDetails,
  editList,
  deleteList,
  fetchAllContactList,
  showcontactDetails,
} from "../../controller/agent/addList.js";

import { 
  initiateCall,
  initiateBulkCalls,
  initiateFilteredCalls,
  getQueueStatus
} from "../../controller/agent/calliniciate.js";

import { callTranscript } from "../../controller/calls/callhistory.js";
import { getLiveStatus, saveLiveStatus } from "../../controller/agent/callStatus.js";
import { fetchAllContacts, getUploadDetail } from "../../controller/agent/allContacts.js";
import {authMiddleware} from "../../controller/auth/authController.js"

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post("/upload-xlsx", authMiddleware, upload.single("file"), handleContactUpload);
router.post("/add", authMiddleware, addContactDetails);
router.put("/edit/:id", authMiddleware, editList);
router.delete("/delete/:id", authMiddleware, deleteList);
router.get("/get", authMiddleware, fetchAllContactList);
router.get("/get/:id", authMiddleware, showcontactDetails);


router.post("/call/:customerId", initiateCall);
router.get("/callTranscript/:customerId", callTranscript);
router.post("/call-bulk", initiateBulkCalls);
router.post("/call-filtered", initiateFilteredCalls);
router.get("/queue-status", getQueueStatus);
// router.post("/call/:customerId", authMiddleware, initiateCall);
// router.get("/callTranscript/:customerId", authMiddleware, callTranscript);
// router.post("/call-bulk", authMiddleware,initiateBulkCalls);
// router.post("/call-filtered",authMiddleware, initiateFilteredCalls);
// router.get("/queue-status",authMiddleware, getQueueStatus);

router.post(
  "/call/status",
  twilio.webhook({ validate: true }), 
  saveLiveStatus
);
router.get("/status/:callId", getLiveStatus);

export default router;
//All concats
router.get("/allcontacts",authMiddleware,fetchAllContacts);
router.get("/allconcats/:id",authMiddleware,getUploadDetail)