import { zukanEntries } from 'svelte-zukan';
import { groups } from '../groups';

export const entries = () => zukanEntries(groups);
