// ADAPT: you almost certainly already have a service-role client helper
// somewhere in lib/ (used for admin routes / webhooks). If so, delete this
// file and import that one instead — this exists only so the patch works
// standalone. Needs SUPABASE_SERVICE_ROLE_KEY set (server-side only, never
// exposed with NEXT_PUBLIC_).
import { createClient } from '@supabase/supabase-js';

let client;

export function landingSupabaseAdmin() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
