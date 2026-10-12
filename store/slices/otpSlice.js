// The sign-in flow: email -> 6-digit code -> (new admins) profile step.
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "@/services/authApi";
import { toPayload } from "@/services/apiClient";
import { durationToMs } from "@/lib/session";

/** POST /otp/send */
export const sendOtp = createAsyncThunk("otp/send", async (email, { rejectWithValue }) => {
  try {
    const result = await authApi.sendOtp(email.trim());
    return { ...result, sentAt: Date.now() };
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

/** POST /otp/verify. On success authSlice stores the token and profile. */
export const verifyOtp = createAsyncThunk("otp/verify", async ({ email, otp }, { rejectWithValue }) => {
  try {
    const result = await authApi.verifyOtp(email.trim(), otp);
    return { ...result, expiresAt: Date.now() + durationToMs(result.expiresIn) };
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

const initialState = {
  step: "email", // "email" | "code" | "profile"
  email: "",
  sentTo: null, // "self" | "superAdmin"
  isNewAdmin: false,
  sentAt: null,
  codeExpiresAt: null,
  sending: false,
  verifying: false,
  error: null, // { message, status, errorCode }
};

const otpSlice = createSlice({
  name: "otp",
  initialState,
  reducers: {
    setOtpEmail(state, { payload }) { state.email = payload; state.error = null; },
    editEmail(state) { state.step = "email"; state.error = null; state.sentTo = null; state.codeExpiresAt = null; },
    clearOtpError(state) { state.error = null; },
    finishProfileStep() { return initialState; },
    resetOtp() { return initialState; },
  },
  extraReducers: (b) => {
    b.addCase(sendOtp.pending, (s) => { s.sending = true; s.error = null; })
      .addCase(sendOtp.fulfilled, (s, { payload }) => {
        s.sending = false;
        s.step = "code";
        s.email = payload.email || s.email;
        s.sentTo = payload.sentTo;
        s.isNewAdmin = !!payload.isNewAdmin;
        s.sentAt = payload.sentAt;
        s.codeExpiresAt = payload.sentAt + (payload.expiresInSeconds || 300) * 1000;
      })
      .addCase(sendOtp.rejected, (s, { payload }) => { s.sending = false; s.error = payload; })

      .addCase(verifyOtp.pending, (s) => { s.verifying = true; s.error = null; })
      .addCase(verifyOtp.fulfilled, (s, { payload }) => {
        // New admins (or anyone without a name yet) get the profile step
        if (payload.isNewAdmin || !payload.admin?.name) {
          s.verifying = false;
          s.step = "profile";
          return undefined;
        }
        return initialState; // signed in: the flow is done
      })
      .addCase(verifyOtp.rejected, (s, { payload }) => { s.verifying = false; s.error = payload; });
  },
});

export const { setOtpEmail, editEmail, clearOtpError, finishProfileStep, resetOtp } = otpSlice.actions;
export default otpSlice.reducer;
