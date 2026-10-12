"use client";
// Name and photo. Used for a new admin's first sign-in and on the Profile page.
// PATCH /profile, multipart: name and/or avatar (PNG, JPEG or WebP up to 5 MB).
import { useEffect, useId, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "@/components/common/Avatar";
import { clearProfileError, updateProfile } from "@/store/slices/authSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { LIMITS } from "@/lib/site";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function ProfileForm({ welcome = false, onDone }) {
  const dispatch = useDispatch();
  const ids = useId();
  const fileRef = useRef(null);
  const { admin, profileSaving, profileError } = useSelector((s) => s.auth);
  const [name, setName] = useState(admin?.name || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { dispatch(clearProfileError()); }, [dispatch]);

  const trimmed = name.trim();
  const nameChanged = trimmed !== (admin?.name || "");
  const canSave = !profileSaving && (welcome ? !!trimmed : (nameChanged && !!trimmed) || !!file);

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!TYPES.includes(f.type)) return setLocalError("Choose a PNG, JPEG or WebP photo.");
    if (f.size > MAX_BYTES) return setLocalError("That photo is over 5 MB. Choose a smaller one.");
    setLocalError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!trimmed) return setLocalError("Add your name.");
    setLocalError("");
    const patch = {};
    if (welcome || nameChanged) patch.name = trimmed;
    if (file) patch.avatar = file;
    const action = await dispatch(updateProfile(patch));
    if (updateProfile.fulfilled.match(action)) {
      setFile(null);
      setPreview("");
      dispatch(pushToast(welcome ? "Welcome to the Privé certificate portal" : "Profile saved"));
      onDone?.();
    }
  }

  const shown = preview ? { ...admin, avatar: preview } : admin;
  const error = localError || profileError?.message;

  return (
    <form className="profile-form" onSubmit={onSubmit} noValidate>
      <div className="profile-photo">
        <Avatar admin={{ ...shown, name: trimmed || admin?.name }} size={84} />
        <div className="profile-photo__text">
          <span className="label">Photo <span className="muted">(optional)</span></span>
          <span className="hint">PNG, JPEG or WebP, up to 5 MB. Shown next to your name.</span>
          <div className="profile-photo__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              {admin?.avatar || preview ? "Change photo" : "Add photo"}
            </button>
            {file && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setFile(null); setPreview(""); }}>
                Keep current
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept={TYPES.join(",")} hidden onChange={pickFile} />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${ids}-name`}>Your name</label>
        <input
          id={`${ids}-name`}
          className="input"
          value={name}
          maxLength={LIMITS.adminName}
          onChange={(e) => { setName(e.target.value); setLocalError(""); }}
          placeholder="Your full name"
          autoFocus={welcome}
          autoComplete="name"
        />
        <span className="hint">Shown in the portal header.</span>
      </div>

      <div className="field">
        <span className="label">Email</span>
        <span className="profile-email">{admin?.email}</span>
        <span className="hint">You sign in with this address. It can&rsquo;t be changed.</span>
      </div>

      {error && <p className="alert alert--error" role="alert" style={{ margin: 0 }}>{error}</p>}

      <div>
        <button className="btn" type="submit" disabled={!canSave}>
          {profileSaving ? "Saving…" : welcome ? "Continue to certificates" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
