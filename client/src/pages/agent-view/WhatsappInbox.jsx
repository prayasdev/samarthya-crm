import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
import { API_BASE_URL } from "@/config/api";
  MessageCircle,
  Send,
  RefreshCw,
  User,
  AlertCircle,
  CheckCheck,
  X,
} from "lucide-react";

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  
  // Normalize phone number for comparison
  const normalizePhone = (phone) => {
    if (!phone) return "";
    return phone.replace("whatsapp:", "").trim();
  };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations on mount
  useEffect(() => {
    console.log("Component mounted, fetching conversations...");
    fetchConversations();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchConversations();
        if (selectedConversation) {
          loadConversationMessages(selectedConversation, true);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedConversation]);

  const fetchConversations = async () => {
    try {
      setIsFetching(true);
      setError(null);
      console.log(
        "📡 Fetching conversations from:",
        `${API_BASE_URL}/api/whatsapp/conversations`
      );
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/conversations`
      );
      const data = await response.json();
      console.log("Conversations response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch conversations");
      }

      if (data.success) {
        const convArray = Array.isArray(data.conversations)
          ? data.conversations
          : [];
        console.log("Conversations loaded:", convArray.length);
        setConversations(convArray);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setError(`Failed to load conversations: ${error.message}`);
      setConversations([]);
    } finally {
      setIsFetching(false);
    }
  };

  const loadConversationMessages = async (phoneNumber, silent = false) => {
    try {
      if (!silent) {
        setIsLoadingMessages(true);
      }
      setError(null);

      // Extract clean phone number (remove whatsapp: prefix if present)
      const cleanNumber = normalizePhone(phoneNumber);
      console.log("Loading messages for:", cleanNumber);

      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/conversations/${encodeURIComponent(cleanNumber)}`
      );
      const data = await response.json();
      console.log("Messages response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to load messages");
      }

      if (data.success) {
        // Set selected conversation BEFORE sorting messages
        setSelectedConversation(phoneNumber);

        // Sort messages by timestamp
        const sortedMessages = Array.isArray(data.messages)
          ? data.messages.sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          )
          : [];

        console.log("Messages loaded:", sortedMessages.length);
        console.log(
          "Selected conversation now:",
          phoneNumber,
          "Normalized:",
          normalizePhone(phoneNumber)
        );
        setMessages(sortedMessages);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      if (!silent) {
        setError(`Failed to load messages: ${error.message}`);
        setMessages([]);
      }
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  };

  const handleConversationClick = (conv) => {
    console.log("Conversation clicked:", conv);
    console.log("Conv phoneNumber:", conv.phoneNumber);

    if (conv && conv.phoneNumber) {
      loadConversationMessages(conv.phoneNumber);
    } else {
      console.error("Invalid conversation data:", conv);
      setError("Invalid conversation selected");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) {
      console.warn("Cannot send: empty message or no conversation selected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Sending message to:", selectedConversation);
      const response = await fetch(`${API_BASE_URL}/api/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: selectedConversation,
          body: replyText,
          channel: "whatsapp",
        }),
      });

      const result = await response.json();
      console.log("Send response:", result);

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      if (result.success) {
        console.log("Message sent successfully");
        setReplyText("");
        // Refresh messages immediately
        await loadConversationMessages(selectedConversation, true);
        await fetchConversations();
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      setError(`Failed to send message: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "Unknown";
    return normalizePhone(phone);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
    }
  };

  // Debug: Check if selected conversation exists
  const isConvSelected = selectedConversation !== null;

  return (
    <div className="flex h-screen gap-4 p-4 bg-slate-50">
      {/* LEFT SIDEBAR - Conversations List */}
      <div className="w-1/3 flex flex-col gap-3">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg">WhatsApp Inbox</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Auto
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchConversations}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <ScrollArea className="h-full">
              {isFetching && conversations.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <div className="text-sm">No conversations yet</div>
                  <div className="text-xs mt-2">
                    Send a WhatsApp message to start
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations.map((conv, idx) => {
                    const isSelected =
                      normalizePhone(selectedConversation) ===
                      normalizePhone(conv.phoneNumber);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleConversationClick(conv)}
                        className={`w-full p-3 rounded-lg text-left transition-all ${isSelected
                          ? "bg-green-100 border-l-4 border-green-600"
                          : "hover:bg-slate-100"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">
                              {formatPhoneNumber(conv.phoneNumber)}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {conv.lastMessageText || "No messages"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-slate-400">
                              {formatTime(conv.lastMessage)}
                            </span>
                            {conv.unreadCount > 0 && (
                              <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT PANEL - Messages */}
      <div className="w-2/3 flex flex-col gap-3">
        {isConvSelected ? (
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {formatPhoneNumber(selectedConversation)}
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      {messages.length} message
                      {messages.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedConversation(null);
                    setMessages([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-500">
                      Loading messages...
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <div className="text-sm">No messages yet</div>
                      <div className="text-xs mt-1">
                        Start the conversation by sending a message
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.direction === "outbound"
                          ? "justify-end"
                          : "justify-start"
                          }`}
                      >
                        <div
                          className={`max-w-xs rounded-lg px-4 py-2 ${msg.direction === "outbound"
                            ? "bg-green-600 text-white"
                            : "bg-slate-200 text-slate-900"
                            }`}
                        >
                          <p className="text-sm">{msg.body || "(No content)"}</p>
                          {msg.mediaUrl && (
                            <a
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline mt-1 block"
                            >
                              View Media
                            </a>
                          )}
                          <div
                            className={`text-xs mt-1 flex items-center gap-1 ${msg.direction === "outbound"
                              ? "text-green-100"
                              : "text-slate-500"
                              }`}
                          >
                            {formatTime(msg.timestamp)}
                            {msg.direction === "outbound" && (
                              <CheckCheck className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-3 flex-shrink-0">
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded mb-2 flex gap-2">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={isLoading || !replyText.trim()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex-1 flex flex-col items-center justify-center">
            <MessageCircle className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              Welcome to WhatsApp Inbox
            </h3>
            <p className="text-slate-500 text-center">
              Select a conversation from the left to start messaging
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
