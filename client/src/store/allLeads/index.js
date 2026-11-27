// src/store/call-mannager/leads.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/aiCall`;

const initialState = {
  isLoading: false,
  data: [],
  page: 1,
  pageSize: 50,
  order: "desc",
  category: undefined,
  error: null,
};

export const fetchAllLeads = createAsyncThunk(
  "leads/fetchAllLeads",
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const s = getState();
      const {
        page = s?.leads?.page ?? 1,
        pageSize = s?.leads?.pageSize ?? 50,
        order = s?.leads?.order ?? "desc",
        category = s?.leads?.category,
      } = params;

      const res = await axios.get(`${API_URL}/leads`, {
        params: { page, pageSize, order, category },
        withCredentials: true,
      });

      // Expected: { success, page, pageSize, data }
      return res?.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err?.message || "Failed to load leads"
      );
    }
  }
);

const leadsSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    setPage(state, action) {
      state.page = action.payload || 1;
    },
    setPageSize(state, action) {
      state.pageSize = action.payload || 50;
    },
    setOrder(state, action) {
      state.order = action.payload || "desc";
    },
    setCategory(state, action) {
      state.category = action.payload;
    },
    resetLeads(state) {
      state.isLoading = false;
      state.data = [];
      state.page = 1;
      state.pageSize = 50;
      state.order = "desc";
      state.category = undefined;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllLeads.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllLeads.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload?.data || [];
        state.page = action.payload?.page ?? state.page;
        state.pageSize = action.payload?.pageSize ?? state.pageSize;
      })
      .addCase(fetchAllLeads.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Leads fetch failed";
      });
  },
});

export const {
  setPage,
  setPageSize,
  setOrder,
  setCategory,
  resetLeads,
} = leadsSlice.actions;

// Selectors
export const selectLeadsData = (s) => s.leads.data;
export const selectLeadsLoading = (s) => s.leads.isLoading;
export const selectLeadsError = (s) => s.leads.error;
export const selectLeadsPage = (s) => s.leads.page;
export const selectLeadsPageSize = (s) => s.leads.pageSize;
export const selectLeadsOrder = (s) => s.leads.order;
export const selectLeadsCategory = (s) => s.leads.category;

export default leadsSlice.reducer;
