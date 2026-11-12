// Side effects that react to actions, kept out of the reducers.
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { saveSession, clearSession } from "@/lib/session";
import { clearSignatures, saveSignatures } from "@/lib/signatures";
import { verifyOtp } from "./slices/otpSlice";
import { restoreSession, fetchProfile, updateProfile, signOut, sessionExpired } from "./slices/authSlice";
import { resetCertificates } from "./slices/certificatesSlice";
import {
  resetIssue, addSignature, updateSignature, removeSignature, reinsertSignature, autoPlaceSignatures,
} from "./slices/issueSlice";
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
    clearSignatures();
    api.dispatch(resetCertificates());
    api.dispatch(resetIssue());
    api.dispatch(resetOtp());
  },
});

// 4. Keep the signatures in this browser so a reload doesn't lose them
//    (cleared on sign-out above). Saved after a short pause, not on every
//    drag movement.
listenerMiddleware.startListening({
  matcher: isAnyOf(addSignature, updateSignature, removeSignature, reinsertSignature, autoPlaceSignatures),
  effect: async (_, api) => {
    api.cancelActiveListeners();
    await api.delay(400);
    saveSignatures(api.getState().issue.signatures);
  },
});
