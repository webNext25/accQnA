import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const createServerSupabase = () =>
  createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
