import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({
  plugins: [
    // without `groups`, the `svelte-zukan` workspace link would be scanned as a group too
    zukan({ groups: { example: 'src/lib' }, build: true }),
    sveltekit({ adapter: adapter() })
  ]
});
