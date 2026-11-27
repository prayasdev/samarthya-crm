// server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

import smsRoutes from './router/msg/smsRoutes.js';
import emailRoutes from './router/msg/emailRoutes.js';
import messageRoutes from './router/msg/messageRoutes.js';
import whatsappRoutes from './router/msg/whatsappRoutes.js';

import router from "./router/auth/authRoute.js";
import userrouter from "./router/auth/userRoute.js";
import contactLists from "./router/agent/contactList.js";
import uploadData from "./router/createTask/index.js";
import campaignRoutes from './router/campaign/campaigns.js';
import aiCallmanager from "./router/aiCall-Manager/index.js";
import Dashboard from "./router/Dashboard/index.js";

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID_WP || process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN_WP || process.env.TWILIO_AUTH_TOKEN
);

// MongoDB connection
let dbConnected = false;
mongoose.connect(process.env.MONGODB_URL /* v6+ defaults ok */)
  .then(() => {
    dbConnected = true;
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

const app = express();
const port = process.env.PORT || 4000;

// Body/cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS for Vite dev server or your deployed origin(s)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
  })
);

app.get("/", (req, res) => res.send("API is working!"));

// Feature routes
app.use('/api/sms', smsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use("/api/auth", router);
app.use("/api/user", userrouter);
app.use("/api/agent/contactList", contactLists);
app.use("/api/agent/create-task", uploadData);
app.use('/api/campaigns', campaignRoutes);
app.use("/api/aiCall", aiCallmanager);
app.use("/api/dashboard", Dashboard);

// Health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Multi-Channel Backend',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      sms: 'POST /api/sms/send',
      email: 'POST /api/email/send',
      messages: 'GET /api/messages'
    }
  });
});

// WhatsApp/SMS send
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { to, body, mediaUrl, channel = 'whatsapp' } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: 'Fields "to" and "body" are required' });
    }

    let fromNumber, toNumber;

    if (channel === 'whatsapp') {
      // WhatsApp requires whatsapp: prefix
      fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
      toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    } else if (channel === 'sms') {
      // SMS numbers without whatsapp: prefix
      fromNumber = process.env.TWILIO_PHONE_NUMBER || '+14155238886';
      toNumber = to.startsWith('whatsapp:') ? to.replace('whatsapp:', '') : to;
    } else {
      return res.status(400).json({ error: 'Invalid channel. Use "whatsapp" or "sms"' });
    }

    console.log(`Sending ${channel.toUpperCase()} From: ${fromNumber} To: ${toNumber}`);

    const msg = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body,
      ...(mediaUrl ? { mediaUrl } : {})
    });

    // Store outbound WhatsApp messages
    if (channel === 'whatsapp') {
      const WhatsAppMessage = (await import('./models/WhatsAppMessage.js')).default;
      const conversationId = toNumber.replace('whatsapp:', '');

      const outboundMessage = new WhatsAppMessage({
        messageSid: msg.sid,
        from: fromNumber,
        to: toNumber,
        body,
        direction: 'outbound',
        status: msg.status,
        conversationId,
        timestamp: new Date(),
        mediaUrl: mediaUrl || null
      });

      await outboundMessage.save();
      console.log('Outbound message stored:', msg.sid);
    }

    res.json({
      success: true,
      sid: msg.sid,
      status: msg.status,
      channel,
      to: toNumber
    });
  } catch (err) {
    console.error('Error sending message:', err.message);
    res.status(500).json({
      error: err.message,
      code: err.code,
      hint: err.code === 21910 ? 'Ensure "from" and "to" are in same channel (both whatsapp: or both regular numbers)' : null
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// Error handler (must have 4 args)
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

app.listen(port, () => console.log(`Server started on port: ${port}`));
