// Redux store. One store per browser tab (see StoreProvider).
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import otpReducer from "./slices/otpSlice";
import certificatesReducer from "./slices/certificatesSlice";
import issueReducer from "./slices/issueSlice";
import verifyReducer from "./slices/verifySlice";
import uiReducer from "./slices/uiSlice";
import { listenerMiddleware } from "./listeners";

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      otp: otpReducer,
      certificates: certificatesReducer,
      issue: issueReducer,
      verify: verifyReducer,
      ui: uiReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware.middleware),
    devTools: process.env.NODE_ENV !== "production",
  });
}
