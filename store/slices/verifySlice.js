// Public "Verify a Privé certificate" lookup.
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { verifyApi } from "@/services/verifyApi";
import { toPayload } from "@/services/apiClient";

/**
 * GET /certificate/:id. track=true only on the first load of the verify page,
 * so it counts once toward "Checked N times" (not on refetches).
 */
export const lookupCertificate = createAsyncThunk(
  "verify/lookup",
  async ({ id, track = false }, { rejectWithValue }) => {
    try {
      return await verifyApi.lookup(id, { track });
    } catch (err) {
      return rejectWithValue(toPayload(err));
    }
  },
  {
    // React strict mode runs effects twice in development; don't count the visit twice
    condition: ({ id }, { getState }) => getState().verify.loadingId !== id,
  }
);

const initialState = {
  id: "",
  loadingId: null,
  status: "idle", // "idle" | "loading" | "found" | "not-found" | "down"
  result: null, // { valid, status, certificate, checkedAt }
  message: "",
};

const verifySlice = createSlice({
  name: "verify",
  initialState,
  reducers: { resetVerify: () => initialState },
  extraReducers: (b) => {
    b.addCase(lookupCertificate.pending, (s, { meta }) => {
      s.id = meta.arg.id;
      s.loadingId = meta.arg.id;
      s.status = "loading";
      s.result = null;
      s.message = "";
    })
      .addCase(lookupCertificate.fulfilled, (s, { payload, meta }) => {
        if (meta.arg.id !== s.id) return;
        s.loadingId = null;
        s.status = "found";
        s.result = payload;
      })
      .addCase(lookupCertificate.rejected, (s, { payload, meta }) => {
        if (meta.arg.id !== s.id) return;
        s.loadingId = null;
        s.status = payload?.status === 404 ? "not-found" : "down";
        s.message = payload?.message || "";
      });
  },
});

export const { resetVerify } = verifySlice.actions;
export default verifySlice.reducer;
