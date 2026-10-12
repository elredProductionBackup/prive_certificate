// Sign in (OTP) and the admin's own profile.
import { request } from "./apiClient";

export const authApi = {
  /** POST /otp/send -> { email, sentTo: "self"|"superAdmin", isNewAdmin, expiresInSeconds } */
  sendOtp: (email) => request("/otp/send", { method: "POST", json: { email } }),

  /** POST /otp/verify -> { accessToken, expiresIn, isNewAdmin, admin } */
  verifyOtp: (email, otp) => request("/otp/verify", { method: "POST", json: { email, otp } }),

  /** GET /profile -> { adminId, name, email, avatar, role } */
  getProfile: (token) => request("/profile", { token }),

  /** PATCH /profile (multipart: name and/or avatar) -> updated profile */
  updateProfile: (token, { name, avatar }) => {
    const form = new FormData();
    if (name !== undefined) form.append("name", name);
    if (avatar) form.append("avatar", avatar, avatar.name || "avatar");
    return request("/profile", { method: "PATCH", form, token });
  },
};
