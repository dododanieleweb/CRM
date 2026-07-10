import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = createSupabaseServerClient();
  if (!supabase || !tokenHash || !type) return NextResponse.redirect(new URL("/login", url.origin));

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" });
  return NextResponse.redirect(new URL(error ? "/login" : "/", url.origin));
}
