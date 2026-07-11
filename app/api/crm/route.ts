import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "crm-state.json");

const emptyState = {
  darkMode: false,
  crmClients: [],
  socialItems: [],
  adSlots: []
};

function supabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function readLocalState() {
  try {
    return JSON.parse(await readFile(dataFile, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState;
    throw error;
  }
}

type TeamContext = { teamId: string; role: "admin" | "commerciale" | "account" | "marketing" };

async function readState(team?: TeamContext) {
  if (!team) return readLocalState();
  const supabase = supabaseAdminClient();
  if (!supabase) throw new Error("Supabase non configurato");

  const { data, error } = await supabase.from("crm_state").select("state").eq("team_id", team.teamId).maybeSingle();
  if (error) throw error;
  return data?.state ?? emptyState;
}

async function saveState(state: unknown, team?: TeamContext) {
  if (!team) {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryFile, dataFile);
    return;
  }

  const supabase = supabaseAdminClient();
  if (!supabase) throw new Error("Supabase non configurato");
  const { error } = await supabase.from("crm_state").upsert({ team_id: team.teamId, state, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
  if (error) throw error;
}

async function currentTeam() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const admin = supabaseAdminClient();
  if (!admin) return null;
  const { data: membership, error: membershipError } = await admin.from("team_members").select("team_id, role").eq("user_id", data.user.id).maybeSingle();
  if (membershipError || !membership) return null;
  return { teamId: membership.team_id as string, role: membership.role as TeamContext["role"] };
}

export async function GET() {
  try {
    const team = await currentTeam();
    if (team === null) return NextResponse.json({ error: "Autenticazione o team non valido" }, { status: 401 });
    return NextResponse.json(await readState(team));
  } catch (error) {
    console.error("CRM read error", error);
    return NextResponse.json({ error: "Archivio CRM non leggibile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const team = await currentTeam();
    if (team === null) return NextResponse.json({ error: "Autenticazione o team non valido" }, { status: 401 });
    if (team && team.role === "marketing") return NextResponse.json({ error: "Il ruolo Marketing puo solo consultare il CRM" }, { status: 403 });
    const state = await request.json();
    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "Dati CRM non validi" }, { status: 400 });
    }

    await saveState(state, team);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CRM save error", error);
    return NextResponse.json({ error: "Salvataggio CRM non riuscito" }, { status: 500 });
  }
}
