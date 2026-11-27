// src/features/dashboard/summarySlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_BASE = API_BASE_URL;


export const fetchDashboardSummary = createAsyncThunk(
  "dashboard/summary/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/api/dashboard/summary`, {
        withCredentials: true,
        params, // { sinceHours, userId, taskId, category }
      });
      // Expect shape: { success, filters, metrics: { totalCalls, avgCallHours, sentiments, acquiredAttention } }
      return res.data?.metrics || {
        totalCalls: 0,
        avgCallHours: 0,
        sentiments: { Positive: 0, Negative: 0, Neutral: 0 },
        acquiredAttention: {
          canceled: 0,
          busy: 0,
          no_answer: 0,
          failed: 0,
          rejectedOrNoAnswer: 0,
          totalAttention: 0,
        },
      };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err.message);
    }
  }
);

const initialState = {
  metrics: {
    totalCalls: 0,
    avgCallHours: 0,
    sentiments: { Positive: 0, Negative: 0, Neutral: 0 },
    acquiredAttention: {
      canceled: 0,
      busy: 0,
      no_answer: 0,
      failed: 0,
      rejectedOrNoAnswer: 0,
      totalAttention: 0,
    },
  },
  status: "idle",   // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  lastFilters: { sinceHours: null, userId: null, taskId: null, category: null },
};

// helper to normalize sentiment keys and types
function normalizeSentiments(s) {
  const pos = Number(s?.Positive ?? s?.positive ?? s?.POSITIVE ?? 0);
  const neg = Number(s?.Negative ?? s?.negative ?? s?.NEGATIVE ?? 0);
  const neu = Number(s?.Neutral  ?? s?.neutral  ?? s?.NEUTRAL  ?? 0);
  return {
    Positive: Number.isFinite(pos) ? pos : 0,
    Negative: Number.isFinite(neg) ? neg : 0,
    Neutral: Number.isFinite(neu) ? neu : 0,
  };
}

const summarySlice = createSlice({
  name: "dashboardSummary",
  initialState,
  reducers: {
    clearSummaryState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardSummary.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
        state.status = "succeeded";
        const m = action.payload || {};
        state.metrics = {
          totalCalls: Number(m.totalCalls ?? 0),
          avgCallHours: Number(m.avgCallHours ?? 0),
          sentiments: normalizeSentiments(m.sentiments),
          acquiredAttention: {
            canceled: Number(m?.acquiredAttention?.canceled ?? 0),
            busy: Number(m?.acquiredAttention?.busy ?? 0),
            no_answer: Number(m?.acquiredAttention?.no_answer ?? 0),
            failed: Number(m?.acquiredAttention?.failed ?? 0),
            rejectedOrNoAnswer: Number(m?.acquiredAttention?.rejectedOrNoAnswer ?? 0),
            totalAttention: Number(m?.acquiredAttention?.totalAttention ?? 0),
          },
        };
        // persist filters used for this fetch
        state.lastFilters = {
          sinceHours: action.meta?.arg?.sinceHours ?? null,
          userId: action.meta?.arg?.userId ?? null,
          taskId: action.meta?.arg?.taskId ?? null,
          category: action.meta?.arg?.category ?? null,
        };
      })
      .addCase(fetchDashboardSummary.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error?.message || "Failed to load summary";
      });
  },
});

export const { clearSummaryState } = summarySlice.actions;

// Selectors
export const selectSummaryStatus = (state) => state.dashboardSummary.status;
export const selectSummaryError = (state) => state.dashboardSummary.error;
export const selectSummaryMetrics = (state) => state.dashboardSummary.metrics;

export const selectTotalCalls = (state) => state.dashboardSummary.metrics.totalCalls;
export const selectAvgCallHours = (state) => state.dashboardSummary.metrics.avgCallHours;
export const selectSentiments = (state) => state.dashboardSummary.metrics.sentiments;
export const selectAcquiredAttention = (state) => state.dashboardSummary.metrics.acquiredAttention;
export const selectLastFilters = (state) => state.dashboardSummary.lastFilters;

export default summarySlice.reducer;
