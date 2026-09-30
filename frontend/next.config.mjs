/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The contract package's entry point is TypeScript source, so Next must compile it.
  transpilePackages: ["@workflow-demo/contracts"],
};

export default nextConfig;
