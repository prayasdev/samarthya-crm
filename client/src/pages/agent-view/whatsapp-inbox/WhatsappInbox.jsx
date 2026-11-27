import React, { useState, useEffect, useRef } from "react";
import ConversationList from "@/components/agent-view/whatsapp-inbox/ConversationList";
import ChatWindow from "@/components/agent-view/whatsapp-inbox/ChatWindow";
import { API_BASE_URL } from "@/config/api";

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
  
  const normalizePhone = (phone) => {
    if (!phone) return "";
    return phone.replace("whatsapp:", "").trim();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchConversations();
  }, []);

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
      const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch conversations");
      }

      if (data.success) {
        const convArray = Array.isArray(data.conversations)
          ? data.conversations
          : [];
        setConversations(convArray);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      setError(`Failed to load conversations: ${err.message}`);
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

      const cleanNumber = normalizePhone(phoneNumber);
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/conversations/${encodeURIComponent(cleanNumber)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load messages");
      }

      if (data.success) {
        setSelectedConversation(phoneNumber);
        const sortedMessages = Array.isArray(data.messages)
          ? data.messages.sort(
              (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
            )
          : [];
        setMessages(sortedMessages);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      if (!silent) {
        setError(`Failed to load messages: ${err.message}`);
        setMessages([]);
      }
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  };

  const handleConversationClick = (conv) => {
    if (conv && conv.phoneNumber) {
      loadConversationMessages(conv.phoneNumber);
    } else {
      setError("Invalid conversation selected");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    setIsLoading(true);
    setError(null);

    try {
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

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      if (result.success) {
        setReplyText("");
        await loadConversationMessages(selectedConversation, true);
        await fetchConversations();
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
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

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Left Sidebar - Conversation List Component */}
      <div className="w-1/3 flex flex-col gap-3">
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleConversationClick}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onRefresh={fetchConversations}
          isFetching={isFetching}
          error={error}
          formatPhoneNumber={formatPhoneNumber}
          formatTime={formatTime}
          normalizePhone={normalizePhone}
        />
      </div>

      {/* Right Panel - Chat Window Component */}
      <div className="w-2/3 flex flex-col gap-3">
        <ChatWindow
          selectedConversation={selectedConversation}
          messages={messages}
          onCloseConversation={() => {
            setSelectedConversation(null);
            setMessages([]);
          }}
          isLoadingMessages={isLoadingMessages}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendReply={handleSendReply}
          onKeyPress={handleKeyPress}
          isLoading={isLoading}
          error={error}
          formatPhoneNumber={formatPhoneNumber}
          formatTime={formatTime}
          messagesEndRef={messagesEndRef}
        />
      </div>
    </div>
  );
}
