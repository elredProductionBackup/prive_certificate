// Small confirmations shown in the corner ("Email sent", "Deleted …").
import { createSlice, nanoid } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { toasts: [] },
  reducers: {
    pushToast: {
      reducer(state, { payload }) {
        state.toasts.push(payload);
        if (state.toasts.length > 4) state.toasts.shift();
      },
      prepare: (text, tone = "ok") => ({ payload: { id: nanoid(), text, tone } }),
    },
    dismissToast(state, { payload }) { state.toasts = state.toasts.filter((t) => t.id !== payload); },
  },
});

export const { pushToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;
