import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

const required = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const createServerSupabase = () =>
  createClient(
    env.supabaseUrl,
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
