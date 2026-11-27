// src/store/call-mannager/aiCallmanage.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/aiCall`;

const initialState = {
  live: {
    isLoading: false,
    data: [],
    error: null,
    lastFetchedAt: null,
    polling: false,
  },
  all: {
    isLoading: false,
    data: [],
    page: 1,
    pageSize: 100,
    sort: "updated_at_iso",
    order: "desc",
    error: null,
  },
};

export const fetchLiveMonitor = createAsyncThunk(
  "calls/fetchLiveMonitor",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/live-monitor`, {
        withCredentials: true,
      });
      return res?.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load live monitor"
      );
    }
  }
);

const callsSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    startLivePolling(state) {
      state.live.polling = true;
    },
    stopLivePolling(state) {
      state.live.polling = false;
    },
    resetLive(state) {
      state.live = {
        isLoading: false,
        data: [],
        error: null,
        lastFetchedAt: null,
        polling: false,
      };
    },
    setAllPage(state, action) {
      state.all.page = action.payload || 1;
    },
    setAllPageSize(state, action) {
      state.all.pageSize = action.payload || 100;
    },
    setAllSort(state, action) {
      const { sort = "updated_at_iso", order = "desc" } = action.payload || {};
      state.all.sort = sort;
      state.all.order = order;
    },
    resetAll(state) {
      state.all = {
        isLoading: false,
        data: [],
        page: 1,
        pageSize: 100,
        sort: "updated_at_iso",
        order: "desc",
        error: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLiveMonitor.pending, (state) => {
        state.live.isLoading = true;
        state.live.error = null;
      })
      .addCase(fetchLiveMonitor.fulfilled, (state, action) => {
        state.live.isLoading = false;
        state.live.data = action.payload?.data || [];
        state.live.lastFetchedAt = Date.now();
      })
      .addCase(fetchLiveMonitor.rejected, (state, action) => {
        state.live.isLoading = false;
        state.live.error = action.payload || "Live monitor fetch failed";
      });
  },
});

export const {
  startLivePolling,
  stopLivePolling,
  resetLive,
  setAllPage,
  setAllPageSize,
  setAllSort,
  resetAll,
} = callsSlice.actions;

// Existing selectors
export const selectLiveData = (s) => s.calls.live.data;
export const selectLiveLoading = (s) => s.calls.live.isLoading;
export const selectLivePolling = (s) => s.calls.live.polling;

export const selectFirstDurationSec = (s) =>
  (s.calls.live.data && s.calls.live.data.length > 0)
    ? (s.calls.live.data[0].duration_seconds ?? 0)
    : 0;
export const selectTotalDurationSec = (s) =>
  (s.calls.live.data || []).reduce(
    (sum, r) => sum + (Number(r?.duration_seconds) || 0),
    0
  );

export default callsSlice.reducer;
