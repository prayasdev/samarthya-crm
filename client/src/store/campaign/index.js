// src/redux/slices/campaignSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/campaigns`;

export const createNewCampaign = createAsyncThunk(
  "campaigns/create",
  async (campaignData, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/create`, campaignData, {
        withCredentials: true,
      });
      return res.data.data;
    } catch (err) {
      const payload = err.response?.data || {
        message: err.message || "Request failed",
      };
      return rejectWithValue(payload);
    }
  }
);

export const getTaskById = createAsyncThunk(
  "campaigns/getTaskById",
  async ({ taskId, category }, { rejectWithValue }) => {
    try {
      const url = category
        ? `${API_URL}/get/${taskId}?category=${encodeURIComponent(category)}`
        : `${API_URL}/get/${taskId}`;
      const res = await axios.get(url, { withCredentials: true });
      return res.data.data;
    } catch (err) {
      const payload = err.response?.data || {
        message: err.message || "Request failed",
      };
      return rejectWithValue(payload);
    }
  }
);

export const fetchAllCampaigns = createAsyncThunk(
  "campaigns/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.type) qs.set("type", params.type);
      if (params.category) qs.set("category", params.category);
      if (params.q) qs.set("q", params.q);

      const url = qs.toString()
        ? `${API_URL}/retrieve?${qs.toString()}`
        : `${API_URL}/retrieve`;

      const res = await axios.get(url, { withCredentials: true });
      return res.data.data || [];
    } catch (err) {
      const payload = err.response?.data || {
        message: err.message || "Request failed",
      };
      return rejectWithValue(payload);
    }
  }
);

const initialState = {
  isLoading: false,
  campaigns: [],
  taskData: null,
  error: null,
  successMessage: null,
};

const campaignSlice = createSlice({
  name: "campaigns",
  initialState,
  reducers: {
    clearTaskData: (state) => {
      state.taskData = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // createNewCampaign
      .addCase(createNewCampaign.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createNewCampaign.fulfilled, (state, action) => {
        state.isLoading = false;
        // Put newly created campaign at the top
        state.campaigns.unshift(action.payload);
        state.successMessage = "Campaign created successfully!";
        state.error = null;
      })
      .addCase(createNewCampaign.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // fetchAllCampaigns  <-- ADD THESE
      .addCase(fetchAllCampaigns.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllCampaigns.fulfilled, (state, action) => {
        state.isLoading = false;
        state.campaigns = action.payload || [];
        state.error = null;
      })
      .addCase(fetchAllCampaigns.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // getTaskById
      .addCase(getTaskById.pending, (state) => {
        state.isLoading = true;
        state.taskData = null;
      })
      .addCase(getTaskById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.taskData = action.payload;
        state.error = null;
      })
      .addCase(getTaskById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearTaskData } = campaignSlice.actions;
export default campaignSlice.reducer;
