import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => {
    const headers = [
      // Anti-clickjacking
      { key: "X-Frame-Options", value: "DENY" },
      // Anti-MIME sniffing
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Referrer policy
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Disable unnecessary features
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    // Enable HSTS only in production
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;
