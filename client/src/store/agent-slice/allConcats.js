// src/features/contactList/contactListSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const API_URL = `${API_BASE_URL}/api/agent/contactList`;

const initialState = {
  isLoading: false,
  contactList: [],
  error: null,
  successMessage: null,
  byId: {},        
  selectedContactId: null, 
};

export const fetchAllContacts = createAsyncThunk(
  "agent/contactList/allcontacts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/allcontacts`, {
        withCredentials: true,
      });
      return response?.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);

// GET: /allcontacts/:id (detail)
export const fetchContactById = createAsyncThunk(
  "agent/contactList/contactById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/allcontacts/${id}`, {
        withCredentials: true,
      });
      return response?.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  }
);

// PUT: /edit/:id
export const editContact = createAsyncThunk(
  "agent/contactList/editContact",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/edit/${id}`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });
      return { id, data: response?.data?.data || response?.data };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error?.response?.data || error.message);
    }
  }
);

// DELETE: /delete/:id
export const deleteContact = createAsyncThunk(
  "agent/contactList/deleteContact",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_URL}/delete/${id}`, {
        withCredentials: true,
      });
      return { id, ...response?.data };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error?.response?.data || error.message);
    }
  }
);

export const editContactList = editContact;
export const deleteContactList = deleteContact;

const contactListSlice = createSlice({
  name: "contactList",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
    setContactList: (state, action) => {
      state.contactList = Array.isArray(action.payload) ? action.payload : [];
    },
    setSelectedContactId: (state, action) => {
      state.selectedContactId = action.payload || null;
    },
  },
  extraReducers: (builder) => {
    builder
      // list
      .addCase(fetchAllContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllContacts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contactList = action.payload?.data || [];
        for (const doc of state.contactList) {
          if (doc && doc._id) state.byId[doc._id] = doc;
        }
        state.successMessage = "Contacts loaded";
      })
      .addCase(fetchAllContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to load contacts";
      })

      // detail
      .addCase(fetchContactById.pending, (state) => {
        // keep global spinner optional; add local UI loader if desired
        state.error = null;
      })
      .addCase(fetchContactById.fulfilled, (state, action) => {
        const doc = action.payload?.data;
        if (doc && doc._id) {
          state.byId[doc._id] = doc;
          state.selectedContactId = doc._id;
        }
      })
      .addCase(fetchContactById.rejected, (state, action) => {
        state.error = action.payload || "Failed to load contact";
      })

      // edit
      .addCase(editContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(editContact.fulfilled, (state, action) => {
        state.isLoading = false;
        const updated = action.payload?.data;
        if (updated && updated._id) {
          state.byId[updated._id] = updated;
          const idx = state.contactList.findIndex((c) => c._id === updated._id);
          if (idx !== -1) {
            state.contactList[idx] = updated;
          }
        }
        state.successMessage = "Contact updated successfully";
      })
      .addCase(editContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to update contact";
      })

      // delete
      .addCase(deleteContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteContact.fulfilled, (state, action) => {
        state.isLoading = false;
        const id = action.payload?.id;
        if (id) {
          delete state.byId[id];
          state.contactList = state.contactList.filter((c) => c._id !== id);
        }
        state.successMessage = "Contact deleted successfully";
      })
      .addCase(deleteContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to delete contact";
      });
  },
});

export const {
  clearMessages,
  setContactList,
  setSelectedContactId,
} = contactListSlice.actions;

// Selectors
export const selectContacts = (state) => state.contactList.contactList;
export const selectContactsLoading = (state) => state.contactList.isLoading;
export const selectContactsError = (state) => state.contactList.error;
export const selectContactsSuccess = (state) => state.contactList.successMessage;
export const selectContactById = (state, id) => state.contactList.byId[id];
export const selectSelectedContact = (state) =>
  state.contactList.selectedContactId
    ? state.contactList.byId[state.contactList.selectedContactId]
    : null;

export default contactListSlice.reducer;
