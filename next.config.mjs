/** @type {import('next').NextConfig} */
const nextConfig = {
  // Normally the browser calls NEXT_PUBLIC_API_BASE_URL directly.
  // If the API has no CORS for this site, set API_PROXY_TARGET (and leave
  // NEXT_PUBLIC_API_BASE_URL empty) so Next.js forwards the calls instead.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");
    if (!target) return [];
    return [{ source: "/api/certification/:path*", destination: `${target}/api/certification/:path*` }];
  },
};
export default nextConfig;
