import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Paquets serveur chargés depuis node_modules (fichiers WASM, sockets, SMTP).
  serverExternalPackages: ["@electric-sql/pglite", "undici", "nodemailer", "postgres"],
  // Les migrations SQL doivent accompagner le serveur une fois déployé.
  outputFileTracingIncludes: {
    "/api/**/*": ["./drizzle/**/*"],
    "/**/*": ["./drizzle/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
