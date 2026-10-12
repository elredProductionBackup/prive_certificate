// Issued certificates: the table, its search and filters, and row actions.
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { certificatesApi } from "@/services/certificatesApi";
import { toPayload } from "@/services/apiClient";
import { saveBlob } from "@/lib/download";

/** GET /certificates with the current search, filters and page. */
export const fetchCertificates = createAsyncThunk("certificates/fetch", async (_, { getState, rejectWithValue }) => {
  const { auth, certificates: c } = getState();
  try {
    return await certificatesApi.list(auth.token, { ...c.filters, page: c.page, limit: c.limit });
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

/** POST /certificates/:id/email. Saves a new address first when one is given. */
export const resendCertificateEmail = createAsyncThunk(
  "certificates/resendEmail",
  async ({ certificateId, recipientEmail }, { getState, rejectWithValue }) => {
    try {
      return await certificatesApi.resendEmail(getState().auth.token, certificateId, recipientEmail);
    } catch (err) {
      return rejectWithValue(toPayload(err));
    }
  }
);

/** DELETE /certificates/:id */
export const deleteCertificate = createAsyncThunk("certificates/delete", async (certificateId, { getState, dispatch, rejectWithValue }) => {
  try {
    const result = await certificatesApi.remove(getState().auth.token, certificateId);
    dispatch(fetchCertificates()); // stats and paging change too
    return result;
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

/**
 * GET /certificates/export.zip and save it.
 * With ids: exactly those. Without: whatever the table's search and filters show.
 */
export const exportCertificatesZip = createAsyncThunk("certificates/exportZip", async ({ ids } = {}, { getState, rejectWithValue }) => {
  const { auth, certificates: c } = getState();
  try {
    const query = ids?.length ? { ids: ids.join(",") } : { ...c.filters };
    const { blob, filename } = await certificatesApi.exportZip(auth.token, query);
    saveBlob(blob, filename);
    return { filename };
  } catch (err) {
    return rejectWithValue(toPayload(err));
  }
});

const initialState = {
  items: [],
  totalCount: 0,
  totalPages: 1,
  page: 1,
  limit: 20,
  filters: { q: "", status: "all", emailStatus: "all" },
  stats: null, // { issued, active, revoked, verifications }
  status: "idle", // "idle" | "loading" | "succeeded" | "failed"
  error: null,
  latestRequestId: null,
  selected: null, // the certificate open in the modal
  rowBusy: {}, // { [certificateId]: "email" | "delete" }
  exporting: false,
};

// Keeps the table row and the open modal in step after an action.
function replaceCert(state, cert) {
  state.items = state.items.map((c) => (c.certificateId === cert.certificateId ? cert : c));
  if (state.selected?.certificateId === cert.certificateId) state.selected = cert;
}

const certificatesSlice = createSlice({
  name: "certificates",
  initialState,
  reducers: {
    setSearch(state, { payload }) { state.filters.q = payload; state.page = 1; },
    setStatusFilter(state, { payload }) { state.filters.status = payload; state.page = 1; },
    setEmailFilter(state, { payload }) { state.filters.emailStatus = payload; state.page = 1; },
    clearFilters(state) { state.filters = initialState.filters; state.page = 1; },
    setPage(state, { payload }) { state.page = payload; },
    openCertificate(state, { payload }) { state.selected = payload; },
    closeCertificate(state) { state.selected = null; },
    resetCertificates() { return initialState; },
  },
  extraReducers: (b) => {
    b.addCase(fetchCertificates.pending, (s, { meta }) => {
      s.status = "loading";
      s.error = null;
      s.latestRequestId = meta.requestId;
    })
      .addCase(fetchCertificates.fulfilled, (s, { payload, meta }) => {
        if (meta.requestId !== s.latestRequestId) return; // an older search finished late
        s.status = "succeeded";
        s.items = payload.certificates || [];
        s.totalCount = payload.totalCount || 0;
        s.totalPages = Math.max(1, payload.totalPages || 1);
        s.stats = payload.stats || s.stats;
        if (s.selected) {
          const fresh = s.items.find((c) => c.certificateId === s.selected.certificateId);
          if (fresh) s.selected = fresh;
        }
      })
      .addCase(fetchCertificates.rejected, (s, { payload, meta }) => {
        if (meta.requestId !== s.latestRequestId) return;
        s.status = "failed";
        s.error = payload;
      })

      .addCase(resendCertificateEmail.pending, (s, { meta }) => { s.rowBusy[meta.arg.certificateId] = "email"; })
      .addCase(resendCertificateEmail.fulfilled, (s, { payload, meta }) => {
        delete s.rowBusy[meta.arg.certificateId];
        replaceCert(s, payload);
      })
      .addCase(resendCertificateEmail.rejected, (s, { meta }) => { delete s.rowBusy[meta.arg.certificateId]; })

      .addCase(deleteCertificate.pending, (s, { meta }) => { s.rowBusy[meta.arg] = "delete"; })
      .addCase(deleteCertificate.fulfilled, (s, { meta }) => {
        delete s.rowBusy[meta.arg];
        s.items = s.items.filter((c) => c.certificateId !== meta.arg);
        if (s.selected?.certificateId === meta.arg) s.selected = null;
      })
      .addCase(deleteCertificate.rejected, (s, { meta }) => { delete s.rowBusy[meta.arg]; })

      .addCase(exportCertificatesZip.pending, (s) => { s.exporting = true; })
      .addCase(exportCertificatesZip.fulfilled, (s) => { s.exporting = false; })
      .addCase(exportCertificatesZip.rejected, (s) => { s.exporting = false; });
  },
});

export const {
  setSearch, setStatusFilter, setEmailFilter, clearFilters, setPage,
  openCertificate, closeCertificate, resetCertificates,
} = certificatesSlice.actions;

export const selectCertificates = (state) => state.certificates;
export const selectHasFilters = (state) => {
  const f = state.certificates.filters;
  return !!f.q || f.status !== "all" || f.emailStatus !== "all";
};

export default certificatesSlice.reducer;
