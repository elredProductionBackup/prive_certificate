// The signed-in admin: token, profile, and session state.
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "@/services/authApi";
import { toPayload } from "@/services/apiClient";
import { clearSession, loadSession } from "@/lib/session";
import { verifyOtp } from "./otpSlice";

/** Reads the saved session after a page reload. */
export const restoreSession = createAsyncThunk("auth/restore", async () => {
  const saved = loadSession();
  if (!saved) return { session: null, expired: false };
  if (saved.expiresAt && saved.expiresAt <= Date.now()) {
    clearSession();
    return { session: null, expired: true };
  }
  return { session: saved, expired: false };
});

/** GET /profile, for the header after a reload. */
export const fetchProfile = createAsyncThunk("auth/fetchProfile", async (_, { getState, rejectWithValue }) => {
  try {
    return await authApi.getProfile(getState().auth.token);
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

/** PATCH /profile with a name, a photo, or both. */
export const updateProfile = createAsyncThunk("auth/updateProfile", async ({ name, avatar }, { getState, rejectWithValue }) => {
  try {
    return await authApi.updateProfile(getState().auth.token, { name, avatar });
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

const EXPIRED = "Your session expired after 12 hours. Sign in again to carry on.";
const ENDED = "Your session has ended. Sign in again to carry on.";

const initialState = {
  token: null,
  expiresAt: null,
  admin: null, // { adminId, name, email, avatar, role }
  status: "idle", // "idle" | "checking" | "authenticated" | "anonymous"
  sessionMessage: "",
  profileSaving: false,
  profileError: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    signOut() { return { ...initialState, status: "anonymous" }; },
    /** Any admin call answered 401 (errorCode 1 = expired, -1 = other token problems). */
    sessionExpired(state, { payload }) {
      return { ...initialState, status: "anonymous", sessionMessage: payload?.errorCode === 1 ? EXPIRED : ENDED };
    },
    clearSessionMessage(state) { state.sessionMessage = ""; },
    clearProfileError(state) { state.profileError = null; },
  },
  extraReducers: (b) => {
    b.addCase(restoreSession.pending, (s) => { if (s.status === "idle") s.status = "checking"; })
      .addCase(restoreSession.fulfilled, (s, { payload }) => {
        if (s.status === "authenticated") return; // signed in meanwhile
        if (payload.session) {
          s.token = payload.session.token;
          s.expiresAt = payload.session.expiresAt;
          s.admin = payload.session.admin;
          s.status = "authenticated";
        } else {
          s.status = "anonymous";
          if (payload.expired) s.sessionMessage = EXPIRED;
        }
      })

      .addCase(verifyOtp.fulfilled, (s, { payload }) => {
        s.token = payload.accessToken;
        s.expiresAt = payload.expiresAt;
        s.admin = payload.admin;
        s.status = "authenticated";
        s.sessionMessage = "";
      })

      .addCase(fetchProfile.fulfilled, (s, { payload }) => { s.admin = payload; })

      .addCase(updateProfile.pending, (s) => { s.profileSaving = true; s.profileError = null; })
      .addCase(updateProfile.fulfilled, (s, { payload }) => { s.profileSaving = false; s.admin = payload; })
      .addCase(updateProfile.rejected, (s, { payload }) => { s.profileSaving = false; s.profileError = payload; });
  },
});

export const { signOut, sessionExpired, clearSessionMessage, clearProfileError } = authSlice.actions;

export const selectAuth = (state) => state.auth;
export const selectAdmin = (state) => state.auth.admin;
export const selectIsAuthed = (state) => state.auth.status === "authenticated";

export default authSlice.reducer;
