// store/bulk-calls-slice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/contactList`;

const initialState = {
  isLoading: false,
  data: null,            // API response payload
  error: null,
  successMessage: null,
};

export const bulkCallsStart = createAsyncThunk(
  "agent/contactList/call-bulk",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/call-bulk`, {}, { withCredentials: true });
      return res?.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to queue bulk calls"
      );
    }
  }
);

const bulkCallsSlice = createSlice({
  name: "bulkCalls",
  initialState,
  reducers: {
    resetBulkCallsState: (state) => {
      state.isLoading = false;
      state.data = null;
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bulkCallsStart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(bulkCallsStart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload || null;
        state.successMessage =
          action.payload?.message || "Bulk calls queued successfully!";
      })
      .addCase(bulkCallsStart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Bulk call queueing failed!";
      });
  },
});

export const { resetBulkCallsState } = bulkCallsSlice.actions;
export default bulkCallsSlice.reducer;
