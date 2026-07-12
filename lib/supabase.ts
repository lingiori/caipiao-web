import { createClient } from "@supabase/supabase-js";

export type Kl8DimensionStep = {
  dimension: string;
  max_step: number | null;
  min_step: number | null;
  avg_step: number | null;
  current_distance: number | null;
  tuijian_num: number | null;
  last_updated: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check .env.local."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function getAllDimensionSteps(): Promise<Kl8DimensionStep[]> {
  const { data, error } = await supabase
    .from("kl8_dimension_step")
    .select("*")
    .order("dimension", { ascending: true });

  if (error) {
    console.error("Error fetching kl8_dimension_step:", error);
    throw new Error(error.message);
  }

  return (data as Kl8DimensionStep[]) ?? [];
}
