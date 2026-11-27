// store/call-slice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/contactList`;

const initialState = {
  isLoading: false,
  contactDetails: null,
  error: null,
  successMessage: null,
};

export const callInitiate = createAsyncThunk(
  "agent/contactList/call",
  async ({id,purpose },{ rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${API_URL}/call/${id}`,
        {id,purpose},
        { withCredentials: true }
      );
      return response?.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to initiate call"
      );
    }
  }
);


const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    resetCallState: (state) => {
      state.isLoading = false;
      state.contactDetails = null;
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(callInitiate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(callInitiate.fulfilled, (state, action) => {
        state.isLoading = false;
        state.successMessage = action.payload?.message || "Call initiated successfully!";
      })
      .addCase(callInitiate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Call initiation failed!";
      });
  },
});

export const { resetCallState } = callSlice.actions;
export default callSlice.reducer;
