"use client";
// On first load: restore the saved session, then refresh the profile (GET /profile)
// so the header's name and photo are current.
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile, restoreSession } from "@/store/slices/authSlice";

export default function SessionBootstrap() {
  const dispatch = useDispatch();
  const status = useSelector((s) => s.auth.status);

  useEffect(() => {
    if (status !== "idle") return;
    dispatch(restoreSession()).then((action) => {
      if (action.payload?.session) dispatch(fetchProfile());
    });
  }, [dispatch, status]);

  return null;
}
