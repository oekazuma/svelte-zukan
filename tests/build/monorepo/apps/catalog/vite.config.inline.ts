import { config } from './vite.config.js';

// Kit sets the top-level build.cssCodeSplit to false for this strategy, and the catalog environment inherits it
export default config({ output: { bundleStrategy: 'inline' } });
