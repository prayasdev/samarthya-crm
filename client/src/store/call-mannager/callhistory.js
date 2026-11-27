
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/aiCall`;


export const fetchCallHistory = createAsyncThunk(
  "callHistory/fetchList",
  async ({ limit = 50 } = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/call-history`, {
        params: { limit },
        withCredentials: true,
      });
      return res?.data; 
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch call history"
      );
    }
  }
);


export const fetchCallHistoryByIds = createAsyncThunk(
  "callHistory/fetchByIds",
  async ({ customerId, callId }, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/call-history/${customerId}/${callId}`, {
        withCredentials: true,
      }); 
      return res?.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch call detail"); 
    }
  }
);


const initialState = {
  list: {
    isLoading: false,
    data: [],
    error: null,
    lastFetchedAt: null,
  },
  detail: {
    isLoading: false,
    error: null,
    byKey: {},
  },
};

const callHistorySlice = createSlice({
  name: "callHistory",
  initialState,
  reducers: {
    resetCallHistory(state) {
      state.list = { isLoading: false, data: [], error: null, lastFetchedAt: null };
      state.detail = { isLoading: false, error: null, byKey: {} };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCallHistory.pending, (state) => {
        state.list.isLoading = true;
        state.list.error = null;
      })
      .addCase(fetchCallHistory.fulfilled, (state, action) => {
        state.list.isLoading = false;
        state.list.data = action.payload?.data || [];
        state.list.lastFetchedAt = Date.now();
      })
      .addCase(fetchCallHistory.rejected, (state, action) => {
        state.list.isLoading = false;
        state.list.error = action.payload || "Call history fetch failed";
      });

    builder
      .addCase(fetchCallHistoryByIds.pending, (state) => {
        state.detail.isLoading = true;
        state.detail.error = null;
      })
      .addCase(fetchCallHistoryByIds.fulfilled, (state, action) => {
        state.detail.isLoading = false;
        const row = action.payload?.data;
        if (row?.customer_id && row?.call_id) {
          const key = `${row.customer_id}:${row.call_id}`;
          state.detail.byKey[key] = row;
        }
      })
      .addCase(fetchCallHistoryByIds.rejected, (state, action) => {
        state.detail.isLoading = false;
        state.detail.error = action.payload || "Call detail fetch failed";
      });
  },
});

export const { resetCallHistory } = callHistorySlice.actions;

export const selectCallHistoryRows = (s) => s.callHistory.list.data;
export const selectCallHistoryLoading = (s) => s.callHistory.list.isLoading;
export const selectCallHistoryError = (s) => s.callHistory.list.error;

export const selectCallDetailLoading = (s) => s.callHistory.detail.isLoading;
export const selectCallDetailError = (s) => s.callHistory.detail.error;
export const makeSelectCallDetailByIds =
  (customerId, callId) =>
  (s) =>
    s.callHistory.detail.byKey[`${customerId}:${callId}`];

export default callHistorySlice.reducer;
