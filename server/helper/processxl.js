import xlsx from "xlsx";
import fs from "fs";
import Contact from "../models/contactDetails.js";

export async function processExcelFile(filePath, userId, batchSize = 100) {
  try {
    const workbook = xlsx.readFile(filePath, { raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    if (!jsonData.length) throw new Error("Uploaded file is empty");

    const allowedStatus = [
      "New",
      "Pending",
      "Rejected",
      "Assigned",
      "Imported",
      "Contacted",
      "Interested",
      "No Replay",
      "Engaging",
    ];

    const normalized = jsonData.map((row) => {
      const newRow = {};
      for (const key in row) {
        if (Object.hasOwn(row, key)) {
          newRow[key.trim().toLowerCase()] = row[key];
        }
      }
      return newRow;
    });

    const validContacts = normalized
      .filter(
        (row) =>
          row.name &&
          row.status &&
          allowedStatus.includes(row.status) &&
          row.purpose
      )
      .map((row) => ({
        name: row.name,
        email: row.email || "",
        phone: row.phone || "",
        whatsappNo: row.whatsappno || row["whatsapp no"] || "",
        status: row.status,
        purpose: row.purpose || "General",
        userId,
      }));

    if (validContacts.length === 0)
      throw new Error("No valid contact records found in uploaded file");

    for (let i = 0; i < validContacts.length; i += batchSize) {
      const batch = validContacts.slice(i, i + batchSize);
      await Contact.insertMany(batch);
    }

    fs.unlinkSync(filePath);

    return {
      success: true,
      totalRecords: jsonData.length,
      importedRecords: validContacts.length,
      message: "Contacts uploaded successfully",
    };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error("Error while processing file:", error);
    throw new Error(error.message || "Failed to process uploaded file");
  }
}
