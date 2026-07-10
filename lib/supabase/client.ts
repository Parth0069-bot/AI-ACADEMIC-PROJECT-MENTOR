import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // This only throws in the browser console during development —
  // it means .env.local is missing or the dev server wasn't restarted after adding it.
  console.warn(
    "Supabase env vars are missing. Check .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart `npm run dev`."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
