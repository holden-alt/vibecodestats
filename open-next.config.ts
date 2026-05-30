import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache: every route in this app is dynamic SSR (no ISR/SSG
// revalidation), so there is nothing to cache to R2. Keep the config minimal.
export default defineCloudflareConfig({});
