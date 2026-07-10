import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TeamRole = "admin" | "commerciale" | "account" | "marketing";

function supabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function teamContext() {
  const sessionClient = createSupabaseServerClient();
  const admin = supabaseAdminClient();
  if (!sessionClient || !admin) return { error: "Supabase non configurato", status: 503 as const };

  const { data: auth, error: authError } = await sessionClient.auth.getUser();
  if (authError || !auth.user) return { error: "Autenticazione richiesta", status: 401 as const };

  const { data: membership, error } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !membership) return { error: "Utente non associato a un team", status: 403 as const };
  return { admin, userId: auth.user.id, teamId: membership.team_id as string, role: membership.role as TeamRole };
}

function validRole(role: unknown): role is TeamRole {
  return role === "admin" || role === "commerciale" || role === "account" || role === "marketing";
}

export async function GET() {
  const context = await teamContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });

  const [{ data: team, error: teamError }, { data: memberships, error: membersError }] = await Promise.all([
    context.admin.from("crm_teams").select("name").eq("id", context.teamId).single(),
    context.admin.from("team_members").select("user_id, role, created_at").eq("team_id", context.teamId).order("created_at")
  ]);
  if (teamError || membersError) return NextResponse.json({ error: "Team non leggibile" }, { status: 500 });

  const members = await Promise.all(
    (memberships ?? []).map(async (member) => {
      const { data } = await context.admin.auth.admin.getUserById(member.user_id);
      return { userId: member.user_id, email: data.user?.email ?? "Utente senza email", role: member.role };
    })
  );
  return NextResponse.json({ teamName: team.name, currentRole: context.role, members });
}

export async function POST(request: Request) {
  const context = await teamContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (context.role !== "admin") return NextResponse.json({ error: "Solo l'amministratore puo aggiungere utenti" }, { status: 403 });

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !validRole(body.role)) {
    return NextResponse.json({ error: "Inserisci email valida, password di almeno 8 caratteri e ruolo" }, { status: 400 });
  }

  const { data: created, error: createError } = await context.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? "Creazione utente non riuscita" }, { status: 400 });

  const { error: memberError } = await context.admin
    .from("team_members")
    .insert({ team_id: context.teamId, user_id: created.user.id, role: body.role });
  if (memberError) return NextResponse.json({ error: "Utente creato ma non associato al team" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const context = await teamContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  if (context.role !== "admin") return NextResponse.json({ error: "Solo l'amministratore puo modificare i ruoli" }, { status: 403 });

  const body = await request.json();
  if (typeof body.userId !== "string" || !validRole(body.role)) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  if (body.userId === context.userId && body.role !== "admin") return NextResponse.json({ error: "Non puoi toglierti il ruolo Admin" }, { status: 400 });

  const { error } = await context.admin.from("team_members").update({ role: body.role }).eq("team_id", context.teamId).eq("user_id", body.userId);
  if (error) return NextResponse.json({ error: "Ruolo non aggiornato" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
