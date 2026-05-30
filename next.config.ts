import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;

// Cloudflare Workers (OpenNext) dev integration. Lets `next dev` use the same
// bindings/runtime as the deployed Worker. No-op outside dev.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
