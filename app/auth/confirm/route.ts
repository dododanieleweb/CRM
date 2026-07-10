import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login", url.origin));

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" })
      : { error: new Error("Link di conferma non valido") };
  return NextResponse.redirect(new URL(error ? "/login" : "/", url.origin));
}
