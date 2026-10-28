import { defineEnvVars } from '@sveltejs/kit/env';

// dynamic: the client reads it from SvelteKit's payload at runtime
export const variables = defineEnvVars({ PUBLIC_FIXTURE: { public: true, schema: (value) => value ?? 'unset' } });
