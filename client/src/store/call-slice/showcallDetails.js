import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/contactList`;

const initialState = {
  isLoading: false,
  callHistory: null,
  successMessage: null,
  error: null,
};

export const fetchCallHistory = createAsyncThunk(
  "agent/contactList/fetchCallHistory",
  async ({ customerId, callId }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (customerId) params.append("customerId", customerId);
      if (callId) params.append("callId", callId);

      const response = await axios.get(`${API_URL}/callTranscript?${params.toString()}`, { withCredentials: true });
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || "Failed to fetch call transcript.");
    }
  }
);

const callHistorySlice = createSlice({
  name: "callHistory",
  initialState,
  reducers: {
    clearData: (state) => {
      state.callHistory = null;
      state.successMessage = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCallHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.callHistory = null;
      })
      .addCase(fetchCallHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        const data = action.payload.data;
        state.callHistory = Array.isArray(data) ? data : [data];
        state.successMessage = "Call history fetched successfully.";
      })
      .addCase(fetchCallHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearData } = callHistorySlice.actions;
export default callHistorySlice.reducer;
