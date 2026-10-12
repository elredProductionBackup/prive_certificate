# Privé Certification Portal (frontend)

Next.js 15 (App Router) + Redux Toolkit, built against the **elRED Certification Portal API** (`/api/certification`).

## Setup

```bash
npm install
cp .env.example .env.local      # then set NEXT_PUBLIC_API_BASE_URL
npm run dev                     # http://localhost:3000
```

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API server, e.g. `https://api.example.com`. Calls go to `$BASE/api/certification/...` |
| `NEXT_PUBLIC_SITE_URL` | This portal's public address (copy-link and QR fallback). Empty = current origin |
| `NEXT_PUBLIC_LINKEDIN_ORG_ID` | Privé's LinkedIn page, for "Add to LinkedIn" on the verify page |
| `API_PROXY_TARGET` | Optional. Only if the API blocks the browser with CORS (see below) |

`NEXT_PUBLIC_*` values are baked in when the app builds: restart `npm run dev` or rebuild after changing them.

### Try it without the real API

```bash
npm run mock:api                # fake API on http://localhost:4000
# .env.local: NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm run dev
```

Sign in as `nandini@elred.io` with code `123456`. Any other email goes through the "ask the super admin" flow and becomes a new admin.

## Pages

| Route | Screen | Calls |
| --- | --- | --- |
| `/` | Verify a Privé certificate | none (goes to `/verify/:id`) |
| `/verify/:id` | Result page | `GET /certificate/:id?track=1`, download link |
| `/admin/login` | Email, then 6-digit code, then profile step for new admins | `POST /otp/send`, `POST /otp/verify`, `PATCH /profile` |
| `/admin` | Issue form + issued certificates table | `GET /certificates/newId`, `POST /certificates`, `GET /certificates`, `export.zip`, `POST /certificates/:id/email`, `DELETE /certificates/:id` |
| `/admin/profile` | Name and photo | `GET /profile`, `PATCH /profile` |

## Structure

```
app/                     routes and CSS (globals, certificate, home, verify, admin)
  admin/(protected)/     pages behind the sign-in gate
components/
  admin/                 header, auth gate, sign-in steps, issue form, table, modal, profile form
  certificate/           Certificate (HTML/CSS artwork), CertificatePreview (canvas)
  common/                Select, Switch, Avatar, EmailBadge, Toaster, PublicBar
  verify/, home/         public-side components
services/                one file per API area; apiClient.js is the shared fetch wrapper
store/
  index.js               configureStore
  StoreProvider.js       one store per tab
  listeners.js           401 -> sign out; save/clear the session in localStorage
  slices/                auth, otp, certificates, issue, verify, ui
lib/
  certificateCanvas.js   draws the certificate PNG in the browser
  config.js              every env value
  session.js, site.js, download.js
scripts/mock-api.mjs     local stand-in for the API
```

## How it follows the API docs

- **Responses**: `apiClient.request()` returns `result[0]` and throws an `ApiError` with `status`, `errorCode` and `message`. Messages are shown to the admin as they come.
- **Sessions**: the token is sent as `Authorization: Bearer …` and kept in localStorage, so a reload keeps you signed in (the profile is refreshed with `GET /profile`). Any admin call answering **401** (errorCode `1` or `-1`) signs the admin out, with a note on the sign-in page. Sign out deletes the token; there's no API call.
- **OTP codes**: `5` selects the code to retype, `8` offers "Send a new code", `113`/`115` show the wait message. `sentTo: superAdmin` tells the person to ask the super admin.
- **Issuing**, per person: `newId` → draw the canvas with the real ID and QR (`verifyUrl`) → `canvas.toBlob("image/png")` → multipart `POST /certificates`. A **409** gets a fresh ID and a redraw, up to 3 tries. "A list of people" repeats this one by one; anyone who fails stays in the box with the server's reason.
- **Email**: resend checks `emailStatus` in the response, since a failed send still answers 200. A changed address is sent as `recipientEmail` (saved, then sent).
- **ZIP**: fetched with the token, saved through a temporary `<a download>`. Uses the table's current search and filters, or `ids` for a just-issued batch.
- **Verify**: `track=1` is sent once per visit.

## Notes for the backend

- **CORS**: the browser calls the API directly, so the API must allow this site's origin, the `Authorization` and `Content-Type` headers, and methods `GET, POST, PATCH, DELETE`. It should also `Access-Control-Expose-Headers: Content-Disposition` so the ZIP keeps its filename. If that isn't possible, leave `NEXT_PUBLIC_API_BASE_URL` empty and set `API_PROXY_TARGET`; Next.js then forwards `/api/certification/*` from the same origin.
- **Images**: the table, modal and verify page show `certificateImageUrl` (CloudFront). Downloads use `GET /certificate/:id/download` so the file saves instead of opening.
- The API has no revoke or edit endpoint, so the portal doesn't offer those. Revoked certificates returned by the API still display correctly.
