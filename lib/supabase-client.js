import { createBrowserClient } from '@supabase/ssr';

// Only create the client on the client side – avoids build errors
export const supabase = typeof window !== 'undefined' ? createBrowserClient() : null;