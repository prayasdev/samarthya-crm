// controllers/authController.js
import mongoose from "mongoose";
import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import transporter from "../../config/auth/nodemailer.js";
import dotenv from "dotenv";
dotenv.config();

// Temporary in-memory store for unverified registrations (not persisted to DB until OTP verified)
const pendingRegistrations = new Map();

// Register
export const register = async (req, res) => {
  const { userName, email, password } = req.body;

  if (!userName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide username, email, and password.",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists!",
      });
    }

    // Remove any stale unverified registration for the same email
    for (const [id, pending] of pendingRegistrations.entries()) {
      if (pending.email === email) {
        pendingRegistrations.delete(id);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const tempId = new mongoose.Types.ObjectId().toString();

    pendingRegistrations.set(tempId, {
      _id: tempId,
      userName,
      email,
      password: hashedPassword,
      role: "agent",
      verifyOTP: "",
      verifyOTPExpireAt: 0,
      isAccountVerified: false,
    });

    const token = jwt.sign({ id: tempId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Registration initiated! Please verify your email with OTP.",
      user: {
        id: tempId,
        userName,
        email,
        role: "agent",
      },
    });
  } catch (error) {
    console.error("Register Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again.",
    });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      path: "/", // fixed
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Auth middleware
export const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { _id: decoded.id };
    req.userId = decoded.id;

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Send verify OTP
export const sendVerifyOtp = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const pendingUser = pendingRegistrations.get(String(userId));
    const dbUser = pendingUser ? null : await User.findById(userId);
    const user = pendingUser || dbUser;

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.isAccountVerified) return res.status(400).json({ success: false, message: 'Account already verified' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOTP = otp;
    user.verifyOTPExpireAt = Date.now() + 60 * 60 * 1000; // 1h
    if (dbUser) await dbUser.save();

    console.log(`\n🔑 [OTP] Verification OTP for ${user.email}: ${otp}\n`);

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_MAIL, // verified sender
        to: user.email,
        subject: "Your WhiteSpace Verification OTP",
        text: `Hi ${user.userName},\n\nYour account verification OTP is: ${otp}\n\nThis code is valid for 1 hour.\n\n- WhiteSpace Team`,
      });
      console.log("OTP mail sent:", info.messageId, info.response);
      return res.status(200).json({ success: true, message: "Verification OTP sent successfully." });
    } catch (mailError) {
      console.warn("⚠️ SMTP delivery failed (using console OTP fallback):", mailError?.response || mailError?.message);
      if (process.env.NODE_ENV !== "production") {
        return res.status(200).json({
          success: true,
          message: "OTP generated! Check your server terminal (SMTP pending activation).",
        });
      }
      throw mailError;
    }
  } catch (error) {
    console.error("sendVerifyOtp Error:", error?.response || error?.message, error);
    return res.status(500).json({ success: false, message: "Internal Server Error while sending OTP." });
  }
};

// Verify OTP
export const verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const userId = req.userId;
  if (!userId || !otp) {
    return res.status(400).json({
      success: false,
      message: "Missing Details",
    });
  }
  try {
    const pendingUser = pendingRegistrations.get(String(userId));
    const dbUser = pendingUser ? null : await User.findById(userId);
    const user = pendingUser || dbUser;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.verifyOTP || user.verifyOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.verifyOTPExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP Expired",
      });
    }

    let verifyUser;
    if (pendingUser) {
      const newUser = new User({
        _id: pendingUser._id,
        userName: pendingUser.userName,
        email: pendingUser.email,
        password: pendingUser.password,
        role: "agent",
        isAccountVerified: true,
        verifyOTP: null,
        verifyOTPExpireAt: null,
      });
      verifyUser = await newUser.save();
      pendingRegistrations.delete(String(userId));
    } else {
      dbUser.isAccountVerified = true;
      dbUser.role = dbUser.role === "user" ? "agent" : dbUser.role;
      dbUser.verifyOTP = null;
      dbUser.verifyOTPExpireAt = null;
      verifyUser = await dbUser.save();
    }

    return res.status(200).json({
      success: true,
      message: "Email verified Successfully",
      user: {
        id: verifyUser._id,
        userName: verifyUser.userName,
        email: verifyUser.email,
        role: verifyUser.role,
      },
    });
  } catch (error) {
    console.error("verifyEmail Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Authenticated ping
export const isAuthenticated = async (req, res) => {
  try {
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("isAuthenticated Error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Send reset OTP
export const resetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000; // 15 min
    const resetOtpUser = await user.save();

    console.log(`\n🔑 [RESET OTP] Password Reset OTP for ${resetOtpUser.email}: ${otp}\n`);

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_MAIL,
        to: resetOtpUser.email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}. This code is valid for 15 minutes.`,
      });
      console.log("Reset OTP mail sent:", info.messageId, info.response);
    } catch (mailError) {
      console.warn("⚠️ Reset SMTP delivery failed (using console OTP fallback):", mailError?.response || mailError?.message);
      if (process.env.NODE_ENV === "production") throw mailError;
    }

    return res.status(200).json({
      success: true,
      message: "Verification OTP sent",
      user: {
        id: resetOtpUser._id,
        userName: resetOtpUser.userName,
        email: resetOtpUser.email,
      },
    });
  } catch (error) {
    console.error("resetOtp Error", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};

// Reset password
export const ResetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!otp || !email || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email, OTP, and new password are required.",
    });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }
    if (!user.resetOtpExpireAt || user.resetOtpExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpireAt = null;

    const savedUser = await user.save();

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_MAIL,
        to: email,
        subject: "Password Changed",
        text: "Your password has been successfully changed. If you did not initiate this change, please contact support immediately.",
      });
      console.log("Password change mail sent:", info.messageId, info.response);
    } catch (mailErr) {
      console.error("Password change email failed:", mailErr?.response || mailErr?.message, mailErr);
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in.",
      user: {
        id: savedUser._id,
        userName: savedUser.userName,
        email: savedUser.email,
      },
    });
  } catch (error) {
    console.log("ResetPassword Error", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};
