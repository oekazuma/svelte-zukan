import { config } from './vite.config.js';

// SvelteKit sets Vite's `base` from `paths.base`
export default config({ paths: { base: '/app' } });
