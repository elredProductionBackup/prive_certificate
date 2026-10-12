// Side effects that react to actions, kept out of the reducers.
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { saveSession, clearSession } from "@/lib/session";
import { verifyOtp } from "./slices/otpSlice";
import { restoreSession, fetchProfile, updateProfile, signOut, sessionExpired } from "./slices/authSlice";
import { resetCertificates } from "./slices/certificatesSlice";
import { resetIssue } from "./slices/issueSlice";
import { resetOtp } from "./slices/otpSlice";

export const listenerMiddleware = createListenerMiddleware();

// 1. Any admin call answered HTTP 401 means sign in again (errorCode 1 or -1).
listenerMiddleware.startListening({
  predicate: (action, state) =>
    action.type.endsWith("/rejected") && action.payload?.status === 401 && !!state.auth.token,
  effect: (action, api) => {
    api.dispatch(sessionExpired({ errorCode: action.payload.errorCode }));
  },
});

// 2. Keep the session in localStorage so a reload keeps you signed in.
listenerMiddleware.startListening({
  matcher: isAnyOf(verifyOtp.fulfilled, fetchProfile.fulfilled, updateProfile.fulfilled, restoreSession.fulfilled),
  effect: (_, api) => {
    const { token, expiresAt, admin } = api.getState().auth;
    if (token) saveSession({ token, expiresAt, admin });
  },
});

// 3. Signing out (or being signed out) forgets the session and clears admin data.
listenerMiddleware.startListening({
  matcher: isAnyOf(signOut, sessionExpired),
  effect: (_, api) => {
    clearSession();
    api.dispatch(resetCertificates());
    api.dispatch(resetIssue());
    api.dispatch(resetOtp());
  },
});
