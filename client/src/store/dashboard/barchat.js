
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_BASE =API_BASE_URL;


export const fetchCategoryDistribution = createAsyncThunk(
  "dashboard/categories/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/api/dashboard/barchat`, {
        withCredentials: true,
        params,
      });
      // Expect: { success, total, series: [{ name, value, count, percent }] }
      const series = Array.isArray(res.data?.series) ? res.data.series : [];
      const total = Number(res.data?.total ?? 0);

      // Normalize types defensively
      const safe = series.map((s) => ({
        name: String(s?.name ?? "Other"),
        value: Number(s?.value ?? 0),
        count: Number(s?.count ?? s?.value ?? 0),
        percent: Number(s?.percent ?? 0),
      }));

      return { total: Number.isFinite(total) ? total : 0, series: safe };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err.message);
    }
  }
);

const initialState = {
  total: 0,
  series: [],             // [{ name, value, count, percent }]
  status: "idle",         // idle | loading | succeeded | failed
  error: null,
  lastFilters: { userId: null, taskId: null, category: null, sinceHours: null, includeOther: "true", topN: null },
};

const categoryDistributionSlice = createSlice({
  name: "categoryDistribution",
  initialState,
  reducers: {
    clearCategoryDistribution: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategoryDistribution.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCategoryDistribution.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.total = action.payload?.total ?? 0;
        state.series = action.payload?.series ?? [];
        state.lastFilters = {
          userId: action.meta?.arg?.userId ?? null,
          taskId: action.meta?.arg?.taskId ?? null,
          category: action.meta?.arg?.category ?? null,
          sinceHours: action.meta?.arg?.sinceHours ?? null,
          includeOther: action.meta?.arg?.includeOther ?? "true",
          topN: action.meta?.arg?.topN ?? null,
        };
      })
      .addCase(fetchCategoryDistribution.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error?.message || "Failed to load categories";
      });
  },
});

export const { clearCategoryDistribution } = categoryDistributionSlice.actions;

// Selectors
export const selectCategoryStatus = (state) => state.categoryDistribution.status;
export const selectCategoryError = (state) => state.categoryDistribution.error;
export const selectCategorySeries = (state) => state.categoryDistribution.series; // feed to Recharts Pie as data [name,value]
export const selectCategoryTotal = (state) => state.categoryDistribution.total;
export const selectCategoryLastFilters = (state) => state.categoryDistribution.lastFilters;

export default categoryDistributionSlice.reducer;
