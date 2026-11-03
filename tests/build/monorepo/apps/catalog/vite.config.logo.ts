import { config } from './vite.config.js';

export default config(process.env.FIXTURE_BASE ? { paths: { base: '/app' } } : {}, {
  logo: process.env.FIXTURE_LOGO ?? 'static/logo.svg'
});
