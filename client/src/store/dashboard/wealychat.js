// src/store/dashboard/weeklyPerformanceSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_BASE = API_BASE_URL;

export const fetchWeeklyPerformance = createAsyncThunk(
  "dashboard/weeklyPerformance/fetch",
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/api/dashboard/weaklychat`, {
        withCredentials: true,
        params: { days },
      });
      return Array.isArray(res.data?.series) ? res.data.series : [];
    } catch (err) {
      return rejectWithValue(err?.response?.data || err.message);
    }
  }
);

const initialState = {
  series: [],
  status: "idle",
  error: null,
  lastDays: 7,
};

const weeklyPerformanceSlice = createSlice({
  name: "weeklyPerformance",
  initialState,
  reducers: {
    clearWeeklyPerformance: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeeklyPerformance.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchWeeklyPerformance.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.series = action.payload || [];
        state.lastDays = action.meta?.arg?.days ?? 7;
      })
      .addCase(fetchWeeklyPerformance.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          action.payload || action.error?.message || "Failed to load weekly performance";
      });
  },
});

export const { clearWeeklyPerformance } = weeklyPerformanceSlice.actions;

export const selectWeeklyPerformanceStatus = (state) => state.weeklyPerformance.status;
export const selectWeeklyPerformanceSeries = (state) => state.weeklyPerformance.series;
export const selectWeeklyPerformanceError = (state) => state.weeklyPerformance.error;
export const selectWeeklyPerformanceLastDays = (state) => state.weeklyPerformance.lastDays;

export default weeklyPerformanceSlice.reducer;
