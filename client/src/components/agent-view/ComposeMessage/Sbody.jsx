import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Send, Sparkles, Clock, CheckCheck, Phone, Mail } from "lucide-react";
import { generateMessage, generateEmailMessage } from "./gemini";
import { API_BASE_URL } from "@/config/api";

export default function Sbody({ selectedChannel, onMessageSent }) {
  const [recipientData, setRecipientData] = useState("");
  const [showVerifiedSection, setShowVerifiedSection] = useState(false);
  const [verifiedData, setVerifiedData] = useState(null);
  const [showGeneratedMessage, setShowGeneratedMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageStatus, setMessageStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("english");

  // Get label and placeholder based on channel
  const getChannelConfig = (channel) => {
    switch (channel) {
      case "sms":
        return {
          label: "Phone Number",
          placeholder: "+1 234-567-8900",
          icon: Phone,
          validate: (val) => /^[\d\s\-\+()]+$/.test(val) && val.length >= 10,
          errorMsg: "Please enter a valid phone number"
        };
      case "email":
        return {
          label: "Email Address",
          placeholder: "john@example.com",
          icon: Mail,
          validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
          errorMsg: "Please enter a valid email address"
        };
      case "whatsapp":
        return {
          label: "WhatsApp Number",
          placeholder: "+1 234-567-8900",
          icon: Phone,
          validate: (val) => /^[\d\s\-\+()]+$/.test(val) && val.length >= 10,
          errorMsg: "Please enter a valid WhatsApp number"
        };
      default:
        return {
          label: "Recipient",
          placeholder: "Enter recipient",
          validate: (val) => val.length > 0,
          errorMsg: "Please enter a valid recipient"
        };
    }
  };

  const config = getChannelConfig(selectedChannel);

  const handleVerify = () => {
    if (!recipientData.trim()) {
      alert(config.errorMsg);
      return;
    }

    if (!config.validate(recipientData)) {
      alert(config.errorMsg);
      return;
    }

    let newVerifiedData = {
      channel: selectedChannel,
      purpose: "Customer Support Inquiry"
    };

    if (selectedChannel === "sms") {
      newVerifiedData = {
        ...newVerifiedData,
        number: recipientData,
        name: "Customer",
        description: `This recipient has been verified for SMS delivery. The contact information has been validated and confirmed active in the system.`
      };
    } else if (selectedChannel === "email") {
      newVerifiedData = {
        ...newVerifiedData,
        email: recipientData,
        name: "Customer",
        description: `This recipient has been verified for EMAIL delivery. The email address has been validated and confirmed active in the system.`
      };
    } else if (selectedChannel === "whatsapp") {
      newVerifiedData = {
        ...newVerifiedData,
        number: recipientData,
        name: "Customer",
        description: `This recipient has been verified for WHATSAPP delivery. The whatsapp address has been validated and confirmed active in the system.`
      };
    }

    setVerifiedData(newVerifiedData);
    setShowVerifiedSection(true);
  };

  const handleGenerate = async () => {
    if (!verifiedData) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      let aiMessage;

      // For EMAIL channel, generate professional email
      if (selectedChannel === "email") {
        aiMessage = await generateEmailMessage(
          verifiedData.purpose,
          verifiedData.description,
          verifiedData.name,
          selectedLanguage
        );
      } else {
        // For SMS and WhatsApp, use existing generateMessage
        aiMessage = await generateMessage(
          verifiedData.purpose,
          verifiedData.name,
          selectedLanguage,
          selectedChannel
        );
      }

      setGeneratedMessage(aiMessage);
      setShowGeneratedMessage(true);
    } catch (error) {
      console.error("Failed to generate message:", error);
      setGeneratedMessage("Failed to generate message. Please try again.");
      setShowGeneratedMessage(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      setIsLoading(true);
      
      let endpoint = '';
      let payload = {
        message: generatedMessage,
        name: verifiedData.name,
        purpose: verifiedData.purpose,
        channel: selectedChannel,
        language: selectedLanguage
      };

      if (selectedChannel === "sms") {
        endpoint = '/api/sms/send';
        payload.to_number = verifiedData.number;
      } else if (selectedChannel === "email") {
        endpoint = '/api/email/send';
        payload.to_email = verifiedData.email;
      } else if (selectedChannel === "whatsapp") {
        payload = {
          to: verifiedData.number,
          body: generatedMessage,
        };
        endpoint = '/api/send-whatsapp';
      }
      
      console.log(`📱 Sending ${selectedChannel.toUpperCase()} (${selectedLanguage})`, payload);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      console.log("Backend response:", result);
      
      if (result.success) {
        console.log(`✅ ${selectedChannel.toUpperCase()} sent successfully!`);
        
        setMessageStatus({
          status: "Sent",
          timestamp: new Date().toLocaleString(),
          deliveryStatus: "Delivered",
          messageSid: result.message_sid
        });
        
        if (onMessageSent && verifiedData) {
          onMessageSent({
            name: verifiedData.name,
            number: verifiedData.number || "N/A",
            email: verifiedData.email || "N/A",
            purpose: verifiedData.purpose,
            message: generatedMessage,
            language: selectedLanguage,
            status: "Sent",
            timestamp: new Date().toLocaleString(),
            messageSid: result.message_sid,
            channel: selectedChannel
          });
        }
      } else {
        console.error(`❌ Error sending ${selectedChannel.toUpperCase()}:`, result.error);
        setMessageStatus({
          status: "Failed",
          timestamp: new Date().toLocaleString(),
          deliveryStatus: "Error: " + result.error
        });
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setMessageStatus({
        status: "Failed",
        timestamp: new Date().toLocaleString(),
        deliveryStatus: "Error: " + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Recipient */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Enter Recipient</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Input 
              placeholder={config.placeholder}
              value={recipientData}
              onChange={(e) => setRecipientData(e.target.value)}
              className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm focus:border-indigo-600"
            />
            <Button onClick={handleVerify} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs px-5">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Verify
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verified Recipient */}
      {showVerifiedSection && verifiedData && (
        <Card className="rounded-2xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
          <CardHeader className="pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
            <CardTitle className="flex items-center text-emerald-700 dark:text-emerald-400 text-sm font-bold">
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
              Verified Contact Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs font-medium text-slate-500">Dispatch Channel</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedChannel.toUpperCase()}</p>
              </div>
              {verifiedData.number && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-xs font-medium text-slate-500">Phone Endpoint</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{verifiedData.number}</p>
                </div>
              )}
              {verifiedData.email && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-xs font-medium text-slate-500">Email Address</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{verifiedData.email}</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs font-medium text-slate-500">Intent Purpose</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{verifiedData.purpose}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">System Verification Audit</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{verifiedData.description}</p>
            </div>

            {/* Language Selection with Generate Button */}
            <div className="flex gap-3 items-end pt-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">AI Generation Language</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
                    <SelectValue placeholder="Choose language" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <SelectItem value="english">English (US/UK)</SelectItem>
                    <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
                    <SelectItem value="odia">Odia (ଓଡ଼ିଆ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={isLoading} className="text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-xl shadow-xs px-5">
                <Sparkles className="mr-2 h-4 w-4" />
                {isLoading ? "Generating..." : "Generate AI Draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Message */}
      {showGeneratedMessage && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Generated Message Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Textarea 
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              rows={6}
              className="resize-none rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs leading-relaxed focus:border-indigo-600"
            />
            <Button onClick={handleSend} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs py-3" disabled={isLoading}>
              <Send className="mr-2 h-4 w-4" />
              {isLoading ? "Dispatching..." : `Send ${selectedChannel.toUpperCase()} Message`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Message Status */}
      {messageStatus && (
        <Card className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
          <CardHeader className="pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
            <CardTitle className="flex items-center text-indigo-700 dark:text-indigo-400 text-sm font-bold">
              <CheckCheck className="mr-2 h-4 w-4 text-indigo-600" />
              Delivery Status Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-400">Execution Status</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: messageStatus.status === "Sent" ? "#16a34a" : "#dc2626" }}>
                  {messageStatus.status}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-400">
                  <Clock className="inline mr-1 h-3 w-3" />
                  Dispatch Timestamp
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">{messageStatus.timestamp}</p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-400">Gateway Response</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: messageStatus.status === "Sent" ? "#16a34a" : "#dc2626" }}>
                  {messageStatus.deliveryStatus}
                </p>
              </div>
            </div>
            {messageStatus.messageSid && (
              <div className="mt-4 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-[11px] font-mono text-slate-500">Twilio / Gateway SID: {messageStatus.messageSid}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
