import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/contactList`;

const initialState = {
  isLoading: false,
  contactList: [],
  error: null,
  successMessage: null,
};


export const uploadContactList = createAsyncThunk(
  "agent/contactList/uploadContactList",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${API_URL}/upload-xlsx`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);


export const addNewContact = createAsyncThunk(
  "agent/contactList/addContact",
  async (contactData, { rejectWithValue }) => {
    try {
      // Ensure purpose field exists
      if (!contactData.purpose) {
        throw new Error("Purpose field is required");
      }

      const response = await axios.post(`${API_URL}/add`, contactData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);


export const editContactList = createAsyncThunk(
  "agent/contactList/editContact",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      if (!formData.purpose) {
        throw new Error("Purpose field is required");
      }

      const response = await axios.put(`${API_URL}/edit/${id}`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);


export const deleteContactList = createAsyncThunk(
  "agent/contactList/deleteContact",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_URL}/delete/${id}`, {
        withCredentials: true,
      });
      return { id, ...response.data };
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);


export const fetchAllContactList = createAsyncThunk(
  "agent/contactList/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/get`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);

const contactListSlice = createSlice({
  name: "contactList",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllContactList.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllContactList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contactList = action.payload?.data || [];
      })
      .addCase(fetchAllContactList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(addNewContact.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addNewContact.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contactList.push(action.payload.data);
        state.successMessage = "Contact added successfully!";
      })
      .addCase(addNewContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })


      .addCase(editContactList.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(editContactList.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.contactList.findIndex(
          (c) => c._id === action.payload.data._id
        );
        if (index !== -1) {
          state.contactList[index] = action.payload.data;
        }
        state.successMessage = "Contact updated successfully!";
      })
      .addCase(editContactList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })


      .addCase(deleteContactList.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteContactList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contactList = state.contactList.filter(
          (c) => c._id !== action.payload.id
        );
        state.successMessage = "Contact deleted successfully!";
      })
      .addCase(deleteContactList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(uploadContactList.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(uploadContactList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.successMessage =
          action.payload?.message || "Excel uploaded successfully!";
      })
      .addCase(uploadContactList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearMessages } = contactListSlice.actions;
export default contactListSlice.reducer;
