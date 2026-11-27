import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/create-task`;

export const uploadDetails = createAsyncThunk(
  "agent/uploadDetails",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err) {
      console.error("UPLOAD ERROR:", err.response?.data || err.message);
      return rejectWithValue(
        err.response?.data || { message: "Upload failed" }
      );
    }
  }
);

export const fetchAllDetails = createAsyncThunk(
  "agent/fetchAllDetails",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/upload-details`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data || { message: "Fetch failed" }
      );
    }
  }
);

export const fetchSingleTask = createAsyncThunk(
  "upload/fetchSingleTask",
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/single/${taskId}`,{withCredentials:true});
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch task"
      );
    }
  }
);


export const deleteTask = createAsyncThunk(
  "agent/deleteTask",
  async (taskId, { rejectWithValue }) => {
    try {
      const res = await axios.delete(`${API_URL}/delete-task/${taskId}`, {
        withCredentials: true,
      });
      return { taskId, message: res.data.message };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data || { message: "Delete failed" }
      );
    }
  }
);

const uploadSlice = createSlice({
  name: "upload",
  initialState: {
    isLoading: false,
    allTasks: [],
    error: null,
    taskDetails: null,
    successMessage: null,
  },
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadDetails.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(uploadDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.successMessage = action.payload.message;
      })
      .addCase(uploadDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload.message;
      })

      // Fetch
      .addCase(fetchAllDetails.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.allTasks = action.payload.data || []; 
      })
      .addCase(fetchAllDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload.message;
      })

      // Delete
      .addCase(deleteTask.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.successMessage = action.payload.message;
        state.allTasks = state.allTasks.filter(
          (t) => t._id !== action.payload.taskId
        );
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload.message;
      })
      .addCase(fetchSingleTask.pending, (state) => {
        state.isLoading = true;
        state.taskDetails = null;
      })
      .addCase(fetchSingleTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.taskDetails = action.payload;
      })
      .addCase(fetchSingleTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload.message;
      });
  },
});

export const { clearMessages } = uploadSlice.actions;
export default uploadSlice.reducer;
