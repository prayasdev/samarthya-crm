import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_BASE = `${API_BASE_URL}/api/aiCall`;

export const fetchLeads = createAsyncThunk(
  "leads/fetchLeads",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/pendingFollowUps`, {
        params,
        withCredentials: true,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Failed to fetch leads"
      );
    }
  }
);

export const fetchCallDetail = createAsyncThunk(
  "leads/fetchCallDetail",
  async (call_id, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/pendingFollowUps/${call_id}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Failed to fetch call details"
      );
    }
  }
);

const initialState = {
  leadsData: [],
  page: 1,
  pageSize: 50,
  order: "desc",
  loadingLeads: false,
  errorLeads: null,

  selectedCall: null,
  loadingCall: false,
  errorCall: null,
};

const leadsSlice = createSlice({
  name: "pendingdata",
  initialState,
  reducers: {
    setPage(state, action) {
      state.page = action.payload;
    },
    setPageSize(state, action) {
      state.pageSize = action.payload;
    },
    setOrder(state, action) {
      state.order = action.payload;
    },
    clearSelectedCall(state) {
      state.selectedCall = null;
      state.loadingCall = false;
      state.errorCall = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeads.pending, (state) => {
        state.loadingLeads = true;
        state.errorLeads = null;
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loadingLeads = false;
        state.leadsData = action.payload.data || [];
        state.page = action.payload.page ?? state.page;
        state.pageSize = action.payload.pageSize ?? state.pageSize;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loadingLeads = false;
        state.errorLeads = action.payload || "Error loading leads";
      })
      .addCase(fetchCallDetail.pending, (state) => {
        state.loadingCall = true;
        state.errorCall = null;
      })
      .addCase(fetchCallDetail.fulfilled, (state, action) => {
        state.loadingCall = false;
        state.selectedCall = action.payload.data || null;
      })
      .addCase(fetchCallDetail.rejected, (state, action) => {
        state.loadingCall = false;
        state.errorCall = action.payload || "Error loading call detail";
      });
  },
});

export const {
  setPage,
  setPageSize,
  setOrder,
  clearSelectedCall,
} = leadsSlice.actions;

export const selectLeadsData = (state) => state.pendingdata.leadsData;
export const selectLeadsLoading = (state) => state.pendingdata.loadingLeads;
export const selectLeadsError = (state) => state.pendingdata.errorLeads;

export const selectSelectedCall = (state) => state.pendingdata.selectedCall;
export const selectCallLoading = (state) => state.pendingdata.loadingCall;
export const selectCallError = (state) => state.pendingdata.errorCall;

export default leadsSlice.reducer;
