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

async function readState(ownerId?: string) {
  if (!ownerId) return readLocalState();
  const supabase = supabaseAdminClient();
  if (!supabase) throw new Error("Supabase non configurato");

  const { data, error } = await supabase.from("crm_state").select("state").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return data?.state ?? emptyState;
}

async function saveState(state: unknown, ownerId?: string) {
  if (!ownerId) {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryFile, dataFile);
    return;
  }

  const supabase = supabaseAdminClient();
  if (!supabase) throw new Error("Supabase non configurato");
  const { error } = await supabase.from("crm_state").upsert({ owner_id: ownerId, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function currentUserId() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function GET() {
  try {
    const ownerId = await currentUserId();
    if (ownerId === null) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
    return NextResponse.json(await readState(ownerId));
  } catch {
    return NextResponse.json({ error: "Archivio CRM non leggibile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (ownerId === null) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
    const state = await request.json();
    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "Dati CRM non validi" }, { status: 400 });
    }

    await saveState(state, ownerId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Salvataggio CRM non riuscito" }, { status: 500 });
  }
}
