"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ContactRound,
  Download,
  FileText,
  Filter,
  Globe2,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Moon,
  PanelLeft,
  Phone,
  PieChart,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trash2,
  Upload,
  Users,
  Workflow,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Aziende", icon: Building2 },
  { label: "Contatti", icon: ContactRound },
  { label: "Opportunita", icon: BriefcaseBusiness },
  { label: "Potenziali", icon: Target },
  { label: "Clienti", icon: Users },
  { label: "Agenda", icon: CalendarDays },
  { label: "Team", icon: ShieldCheck },
  { label: "Pipeline", icon: Workflow },
  { label: "Pubblicita", icon: Megaphone },
  { label: "Social", icon: CalendarDays },
  { label: "SEO", icon: Globe2 },
  { label: "Documenti", icon: FileText },
  { label: "AI Studio", icon: Bot }
];

type StageName = "Lead" | "Contattato" | "Telefonata" | "Appuntamento" | "Preventivo" | "Trattativa" | "Contratto";
type ActivityType = "Email" | "Telefonata" | "Visita" | "Appuntamento" | "Promemoria" | "Task";
type ActivityStatus = "Programmata" | "Da fare" | "Fatta" | "Rimandata" | "Annullata";
type ActivityOutcome = "Da definire" | "Non risponde" | "Interessato" | "Appuntamento fissato" | "Preventivo richiesto" | "Non interessato";
type ContactActivity = {
  id: string;
  type: ActivityType;
  at: string;
  by: string;
  notes: string;
  sector?: string;
  dueDate?: string;
  dueTime?: string;
  reminderAt?: string;
  assignedTo?: string;
  priority?: "Alta" | "Media" | "Bassa";
  outcome?: ActivityOutcome;
  status?: ActivityStatus;
};

type Client = {
  id: string;
  company: string;
  sector: string;
  owner: string;
  email: string;
  phone: string;
  address: string;
  houseNumber: string;
  city: string;
  value: string;
  probability: number;
  priority: "Alta" | "Media" | "Bassa";
  stage: StageName;
  services: string[];
  activityLog: ContactActivity[];
  nextFollowUp: string;
  notes: string;
};

const stageNames: StageName[] = ["Lead", "Contattato", "Telefonata", "Appuntamento", "Preventivo", "Trattativa", "Contratto"];
const clientStages: StageName[] = ["Appuntamento", "Preventivo", "Trattativa", "Contratto"];
const activityStatuses: ActivityStatus[] = ["Programmata", "Da fare", "Fatta", "Rimandata", "Annullata"];
const activityOutcomes: ActivityOutcome[] = ["Da definire", "Non risponde", "Interessato", "Appuntamento fissato", "Preventivo richiesto", "Non interessato"];

const headerAliases: Record<keyof Omit<Client, "id" | "services" | "activityLog">, string[]> = {
  company: ["azienda", "ragione sociale", "societa", "company", "cliente", "nome azienda", "nome"],
  sector: ["settore", "industry", "categoria"],
  owner: ["referente", "contatto", "owner", "responsabile", "nome referente"],
  email: ["email", "e mail", "mail"],
  phone: ["telefono", "phone", "cellulare", "tel"],
  address: ["indirizzo", "via", "street", "address"],
  houseNumber: ["civico", "numero civico", "n civico", "numero"],
  city: ["citta", "city", "comune", "localita"],
  value: ["valore", "importo", "budget", "opportunita", "opportunity value"],
  probability: ["probabilita", "probability", "chance"],
  priority: ["priorita", "priority"],
  stage: ["stato", "fase", "stage", "pipeline"],
  nextFollowUp: ["follow up", "prossimo follow up", "next follow up", "data follow up"],
  notes: ["note", "notes", "commenti", "commento"]
};

function normalizedText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function importedValue(value: unknown) {
  const numeric = Number(String(value ?? "0").replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", "."));
  return `€ ${new Intl.NumberFormat("it-IT").format(Number.isFinite(numeric) ? numeric : 0)}`;
}

function clientLocation(client: Pick<Client, "address" | "houseNumber" | "city">) {
  return [client.address, client.houseNumber, client.city].filter(Boolean).join(", ");
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function activityDateValue(activity: ContactActivity) {
  return activity.dueDate || activity.at || "";
}

function activityDateTimeLabel(activity: ContactActivity) {
  const date = activityDateValue(activity) || "Senza data";
  return activity.dueTime ? `${date} ${activity.dueTime}` : date;
}

function isOpenActivity(activity: ContactActivity) {
  const status = activity.status || (activity.dueDate ? "Programmata" : "Fatta");
  return status !== "Fatta" && status !== "Annullata";
}

function isOverdueActivity(activity: ContactActivity) {
  const dueDate = activity.dueDate || activity.reminderAt;
  if (!dueDate || !isOpenActivity(activity)) return false;
  return dueDate < todayValue();
}

function parseDelimitedRows(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, unknown>[] {
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

const pipeline = [
  { stage: "Lead", color: "bg-sky-500" },
  { stage: "Contattato", color: "bg-cyan-500" },
  { stage: "Appuntamento", color: "bg-teal-500" },
  { stage: "Preventivo", color: "bg-blue-500" },
  { stage: "Contratto", color: "bg-emerald-500" }
];

type SocialPost = {
  id: string;
  title: string;
  channel: string;
  status: "Bozza" | "In approvazione" | "Programmato" | "Pubblicato";
  date: string;
};

const aiActions = [
  "Genera offerta commerciale",
  "Crea piano editoriale",
  "Analizza sito cliente",
  "Scrivi follow-up email"
];

type AdSlot = {
  id: string;
  slot: string;
  booked: number;
  ctr: string;
  renewal: string;
};

type CrmState = {
  darkMode: boolean;
  crmClients: Client[];
  socialItems: SocialPost[];
  adSlots: AdSlot[];
};

type TeamRole = "admin" | "commerciale" | "account" | "marketing";
type TeamMember = { userId: string; email: string; role: TeamRole };
type TeamInfo = { teamName: string; currentRole: TeamRole; members: TeamMember[] };

const roleLabels: Record<TeamRole, string> = {
  admin: "Admin",
  commerciale: "Commerciale",
  account: "Account",
  marketing: "Marketing"
};

const roleDescriptions: Record<TeamRole, string> = {
  admin: "Gestisce utenti, ruoli e tutti i dati del team.",
  commerciale: "Gestisce potenziali, clienti e avanzamento commerciale.",
  account: "Aggiorna schede cliente, attivita e follow-up.",
  marketing: "Consulta il CRM e usa i dati per pianificazione e analisi."
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card p-5 text-card-foreground shadow-soft", className)}>{children}</section>;
}

function IconButton({
  children,
  label,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-lg border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-10 rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary";

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeModule, setActiveModule] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"Tutte" | Client["priority"]>("Tutte");
  const [sectorFilter, setSectorFilter] = useState("Tutti i settori");
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<"Aperte" | "Tutte" | ActivityStatus>("Aperte");
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clearPotentialsOpen, setClearPotentialsOpen] = useState(false);
  const [activityEntry, setActivityEntry] = useState<{ clientId: string; type: ContactActivity["type"] } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [crmClients, setCrmClients] = useState<Client[]>([]);
  const [socialItems, setSocialItems] = useState<SocialPost[]>([]);
  const [adSlots, setAdSlots] = useState<AdSlot[]>([]);
  const [aiResult, setAiResult] = useState("Scegli un'azione AI per generare una bozza operativa collegata ai dati CRM.");
  const [draggingClientId, setDraggingClientId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Client[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [teamError, setTeamError] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);

  const canEditCrm = teamInfo?.currentRole !== "marketing";

  useEffect(() => {
    async function loadCrmState() {
      try {
        const response = await fetch("/api/crm", { cache: "no-store" });
        if (!response.ok) throw new Error("Archivio CRM non disponibile");
        const saved = (await response.json()) as Partial<CrmState>;
        if (typeof saved.darkMode === "boolean") setDarkMode(saved.darkMode);
        if (saved.crmClients) setCrmClients(saved.crmClients);
        if (saved.socialItems) setSocialItems(saved.socialItems);
        if (saved.adSlots) setAdSlots(saved.adSlots);
      } catch {
        setSaveError("Non riesco a raggiungere l'archivio CRM.");
      } finally {
        setStorageReady(true);
      }
    }
    void loadCrmState();
  }, []);

  async function loadTeam() {
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setTeamInfo(await response.json() as TeamInfo);
      setTeamError("");
    } catch {
      setTeamError("Il team sara disponibile dopo la migrazione Supabase.");
    }
  }

  useEffect(() => { void loadTeam(); }, []);

  useEffect(() => {
    if (!storageReady) return;
    void persistCrmState({ darkMode, crmClients, socialItems, adSlots });
  }, [darkMode, crmClients, socialItems, adSlots, storageReady]);

  async function persistCrmState(state: CrmState) {
    try {
      const response = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error("Salvataggio non riuscito");
      setSaveError("");
      return true;
    } catch {
      setSaveError("Il salvataggio CRM non e riuscito.");
      return false;
    }
  }

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return crmClients.filter((client) => {
      const matchesQuery = [client.company, client.sector, client.owner, client.email, client.phone, client.address, client.houseNumber, client.city, client.services.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      const matchesPriority = priorityFilter === "Tutte" || client.priority === priorityFilter;
      const matchesSector = sectorFilter === "Tutti i settori" || client.sector === sectorFilter;
      return matchesQuery && matchesPriority && matchesSector;
    });
  }, [crmClients, priorityFilter, query, sectorFilter]);

  const sectors = useMemo(
    () => Array.from(new Set(crmClients.map((client) => client.sector).filter(Boolean))).sort((first, second) => first.localeCompare(second, "it")),
    [crmClients]
  );

  const potentialClients = useMemo(
    () => filteredClients.filter((client) => !clientStages.includes(client.stage)),
    [filteredClients]
  );

  const actualClients = useMemo(
    () => filteredClients.filter((client) => clientStages.includes(client.stage)),
    [filteredClients]
  );

  const clientsBySector = useMemo(() => {
    return actualClients.reduce<Record<string, Client[]>>((groups, client) => {
      const sector = client.sector || "Da qualificare";
      groups[sector] = [...(groups[sector] || []), client];
      return groups;
    }, {});
  }, [actualClients]);

  const allActivities = useMemo(() => {
    return filteredClients
      .flatMap((client) => (client.activityLog || []).map((activity) => ({ activity, client })))
      .sort((first, second) => {
        const firstDate = `${activityDateValue(first.activity)} ${first.activity.dueTime || ""}`.trim();
        const secondDate = `${activityDateValue(second.activity)} ${second.activity.dueTime || ""}`.trim();
        return firstDate.localeCompare(secondDate);
      });
  }, [filteredClients]);

  const agendaActivities = useMemo(() => {
    return allActivities.filter(({ activity }) => {
      const status = activity.status || (activity.dueDate ? "Programmata" : "Fatta");
      if (agendaStatusFilter === "Tutte") return true;
      if (agendaStatusFilter === "Aperte") return isOpenActivity(activity);
      return status === agendaStatusFilter;
    });
  }, [agendaStatusFilter, allActivities]);

  const overdueActivities = useMemo(
    () => allActivities.filter(({ activity }) => isOverdueActivity(activity)),
    [allActivities]
  );

  const todayActivities = useMemo(
    () => allActivities.filter(({ activity }) => activityDateValue(activity) === todayValue() && isOpenActivity(activity)),
    [allActivities]
  );

  const selectedClient = useMemo(
    () => crmClients.find((client) => client.id === selectedClientId) ?? null,
    [crmClients, selectedClientId]
  );

  const activityClient = useMemo(
    () => activityEntry ? crmClients.find((client) => client.id === activityEntry.clientId) ?? null : null,
    [activityEntry, crmClients]
  );

  const totalPipeline = useMemo(() => filteredClients.length, [filteredClients]);
  const totalValue = useMemo(
    () => filteredClients.reduce((sum, client) => sum + Number(client.value.replace(/[^0-9]/g, "")), 0),
    [filteredClients]
  );
  const contractCount = filteredClients.filter((client) => client.stage === "Contratto").length;
  const conversionRate = Math.round((contractCount / Math.max(filteredClients.length, 1)) * 100);

  const liveKpis = [
    { label: "Pipeline filtrata", value: `€ ${new Intl.NumberFormat("it-IT").format(totalValue)}`, change: `${filteredClients.length} deal`, icon: CircleDollarSign },
    { label: "Nuovi lead", value: String(filteredClients.filter((client) => client.stage === "Lead").length), change: "+ live", icon: Target },
    { label: "Conversion rate", value: `${conversionRate}%`, change: `${contractCount} contratti`, icon: PieChart },
    { label: "Post social", value: String(socialItems.length), change: "calendar", icon: BarChart3 }
  ];

  async function addLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditCrm) return;
    const form = new FormData(event.currentTarget);
    const services = String(form.get("services") || "Consulenza marketing")
      .split(",")
      .map((service) => service.trim())
      .filter(Boolean);

    const newClient: Client = {
      id: `c-${crypto.randomUUID()}`,
      company: String(form.get("company") || "Nuovo lead"),
      sector: String(form.get("sector") || "Da qualificare"),
      owner: String(form.get("owner") || "Da assegnare"),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      address: String(form.get("address") || ""),
      houseNumber: String(form.get("houseNumber") || ""),
      city: String(form.get("city") || ""),
      value: `€ ${new Intl.NumberFormat("it-IT").format(Number(form.get("value") || 0))}`,
      probability: Number(form.get("probability") || 25),
      priority: form.get("priority") as Client["priority"],
      stage: "Lead",
      services,
      activityLog: [],
      nextFollowUp: String(form.get("nextFollowUp") || ""),
      notes: String(form.get("notes") || "")
    };

    const nextClients = [newClient, ...crmClients];
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;

    setCrmClients(nextClients);
    setLeadModalOpen(false);
    setActiveModule("Potenziali");
    event.currentTarget.reset();
  }

  async function saveClientDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditCrm) return;
    if (!selectedClient) return;
    const form = new FormData(event.currentTarget);
    const services = String(form.get("services") || "")
      .split(",")
      .map((service) => service.trim())
      .filter(Boolean);
    const updatedClient: Client = {
      ...selectedClient,
      company: String(form.get("company") || selectedClient.company).trim(),
      sector: String(form.get("sector") || "Da qualificare").trim(),
      owner: String(form.get("owner") || "Da assegnare").trim(),
      email: String(form.get("email") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      address: String(form.get("address") || "").trim(),
      houseNumber: String(form.get("houseNumber") || "").trim(),
      city: String(form.get("city") || "").trim(),
      value: `€ ${new Intl.NumberFormat("it-IT").format(Number(form.get("value") || 0))}`,
      probability: Math.min(100, Math.max(1, Number(form.get("probability") || 25))),
      priority: form.get("priority") as Client["priority"],
      stage: form.get("stage") as StageName,
      services,
      activityLog: selectedClient.activityLog || [],
      nextFollowUp: String(form.get("nextFollowUp") || ""),
      notes: String(form.get("notes") || "")
    };
    const nextClients = crmClients.map((client) => client.id === updatedClient.id ? updatedClient : client);
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;

    setCrmClients(nextClients);
    setSelectedClientId(null);
  }

  async function clearAllPotentials() {
    if (!canEditCrm) return;
    const nextClients = crmClients.filter((client) => clientStages.includes(client.stage));
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;
    setCrmClients(nextClients);
    setSelectedClientId(null);
    setSectorFilter("Tutti i settori");
    setClearPotentialsOpen(false);
  }

  async function saveContactActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditCrm) return;
    if (!activityEntry) return;
    const form = new FormData(event.currentTarget);
    const { clientId, type } = activityEntry;
    const dueDate = String(form.get("dueDate") || "").trim();
    const dueTime = String(form.get("dueTime") || "").trim();
    const reminderAt = String(form.get("reminderAt") || "").trim();
    const outcome = String(form.get("outcome") || "Da definire") as ActivityOutcome;
    const status = String(form.get("status") || (dueDate ? "Programmata" : "Fatta")) as ActivityStatus;
    const nextClients = crmClients.map((client) => {
      if (client.id !== clientId) return client;
      const stage = type === "Email" ? "Contattato" : type === "Telefonata" ? "Telefonata" : client.stage;
      return {
        ...client,
        stage,
        nextFollowUp: dueDate || client.nextFollowUp,
        activityLog: [...(client.activityLog || []), {
          id: crypto.randomUUID(),
          type,
          at: String(form.get("date") || todayValue()),
          by: String(form.get("by") || "Non indicato").trim(),
          notes: String(form.get("notes") || "").trim(),
          sector: String(form.get("sector") || client.sector || "Da qualificare").trim(),
          dueDate,
          dueTime,
          reminderAt,
          assignedTo: String(form.get("assignedTo") || form.get("by") || "Da assegnare").trim(),
          priority: String(form.get("priority") || client.priority || "Media") as Client["priority"],
          outcome,
          status
        }]
      };
    });
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;
    setCrmClients(nextClients);
    setActivityEntry(null);
  }

  async function updateContactActivityStatus(clientId: string, activityId: string, status: ActivityStatus) {
    if (!canEditCrm) return;
    const nextClients = crmClients.map((client) => client.id === clientId
      ? { ...client, activityLog: (client.activityLog || []).map((activity) => activity.id === activityId ? { ...activity, status } : activity) }
      : client
    );
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;
    setCrmClients(nextClients);
  }

  async function promotePotentialClient(clientId: string) {
    if (!canEditCrm) return;
    const nextClients = crmClients.map((client) => client.id === clientId
      ? { ...client, stage: "Appuntamento" as StageName, activityLog: [...(client.activityLog || []), { id: crypto.randomUUID(), type: "Appuntamento" as const, at: todayValue(), by: "Sistema", notes: "Appuntamento confermato", sector: client.sector, priority: client.priority, outcome: "Appuntamento fissato" as const, status: "Programmata" as const, dueDate: client.nextFollowUp || todayValue(), assignedTo: client.owner || "Da assegnare" }] }
      : client
    );
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;
    setCrmClients(nextClients);
    setActiveModule("Clienti");
  }

  function runAi(action: string) {
    const client = filteredClients[0] || crmClients[0];
    if (!client) {
      setAiResult("Aggiungi o importa almeno un lead per generare un contenuto AI collegato al CRM.");
      setActiveModule("AI Studio");
      return;
    }
    const outputs: Record<string, string> = {
      "Genera offerta commerciale": `Offerta per ${client.company}: pacchetto ${client.services.join(", ")} da ${client.value}. Obiettivo: lead qualificati, visibilita locale e report ROI mensile. Prossimo follow-up: ${client.nextFollowUp || "entro 48 ore"}.`,
      "Crea piano editoriale": `Piano editoriale: 3 contenuti social a settimana, 1 articolo sponsorizzato, 1 newsletter mensile e creativita coordinate per ${client.sector}.`,
      "Analizza sito cliente": `Analisi sito ${client.company}: controllare Core Web Vitals, GA4, tracciamento conversioni, title SEO, meta description, pagine servizio e call-to-action.`,
      "Scrivi follow-up email": `Oggetto: Prossimo passo per ${client.company}\n\nCiao ${client.owner}, ti invio una proposta sintetica per trasformare la visibilita online in contatti misurabili. Possiamo sentirci questa settimana per chiudere obiettivi, budget e calendario?`
    };
    setAiResult(outputs[action]);
    setActiveModule("AI Studio");
  }

  function moveClient(clientId: string, stage: StageName) {
    if (!canEditCrm) return;
    setCrmClients((current) => current.map((client) => (client.id === clientId ? { ...client, stage } : client)));
    setDraggingClientId(null);
  }

  function downloadReport() {
    const lines = [
      "BASE CRM - Report",
      `Clienti: ${filteredClients.length}`,
      `Pipeline: € ${new Intl.NumberFormat("it-IT").format(totalValue)}`,
      "",
      ...filteredClients.map((client) => `${client.company} | ${client.stage} | ${client.value} | ${client.probability}%`)
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "osservatore-crm-report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function signOut() {
    void fetch("/auth/signout", { method: "POST" }).finally(() => window.location.assign("/login"));
  }

  async function addTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMemberSaving(true);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), role: form.get("role") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Utente non creato");
      setMemberModalOpen(false);
      await loadTeam();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Utente non creato");
    } finally {
      setMemberSaving(false);
    }
  }

  async function updateTeamRole(userId: string, role: TeamRole) {
    try {
      const response = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Ruolo non aggiornato");
      await loadTeam();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Ruolo non aggiornato");
    }
  }

  async function previewLeadImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError("");
    setImportPreview([]);
    setImportFileName(file.name);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, unknown>[];
      if (extension === "csv" || extension === "tsv") {
        rows = rowsToObjects(parseDelimitedRows(await file.text()));
      } else if (extension === "xlsx") {
        const [firstSheet] = await readXlsxFile(file);
        if (!firstSheet) throw new Error("Il file non contiene fogli leggibili.");
        rows = rowsToObjects(
          firstSheet.data.map((row) => row.map((value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "")))
        );
      } else {
        throw new Error("Formato non supportato. Usa un file .xlsx, .csv o .tsv.");
      }
      if (!rows.length) throw new Error("Il file non contiene righe di dati.");

      const leads = rows
        .map((row, index) => {
          const values = Object.entries(row).reduce<Record<string, unknown>>((result, [key, value]) => {
            result[normalizedText(key)] = value;
            return result;
          }, {});
          const read = (field: keyof typeof headerAliases) => {
            const header = headerAliases[field].find((alias) => alias in values);
            return header ? values[header] : "";
          };
          const rawCompany = read("company");
          if (!String(rawCompany).trim()) return null;
          const rawPriority = normalizedText(read("priority"));
          const parsedProbability = Number(String(read("probability") || "25").replace(/[^0-9]/g, ""));
          const servicesValue = values.servizi || values.services || values.service || "Consulenza marketing";

          return {
            id: `import-${Date.now()}-${index}`,
            company: String(rawCompany).trim(),
            sector: String(read("sector") || "Da qualificare").trim(),
            owner: String(read("owner") || "Da assegnare").trim(),
            email: String(read("email")).trim(),
            phone: String(read("phone")).trim(),
            address: String(read("address")).trim(),
            houseNumber: String(read("houseNumber")).trim(),
            city: String(read("city")).trim(),
            value: importedValue(read("value")),
            probability: Math.min(100, Math.max(1, Number.isFinite(parsedProbability) ? parsedProbability : 25)),
            priority: rawPriority === "alta" ? "Alta" : rawPriority === "bassa" ? "Bassa" : "Media",
            stage: "Lead",
            services: String(servicesValue).split(/[,;|]/).map((service) => service.trim()).filter(Boolean),
            activityLog: [],
            nextFollowUp: String(read("nextFollowUp")).trim(),
            notes: String(read("notes")).trim()
          } as Client;
        })
        .filter((lead): lead is Client => lead !== null);

      if (!leads.length) throw new Error("Manca una colonna Azienda/Ragione sociale o non sono presenti lead validi.");
      setImportPreview(leads);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Non riesco a leggere questo file.");
    }
  }

  function importLeads() {
    const existing = new Set(crmClients.map((client) => `${normalizedText(client.company)}|${normalizedText(client.email)}`));
    const uniqueLeads = importPreview.filter((lead) => !existing.has(`${normalizedText(lead.company)}|${normalizedText(lead.email)}`));
    setCrmClients((current) => [...uniqueLeads, ...current]);
    setImportModalOpen(false);
    setImportPreview([]);
    setImportFileName("");
    setActiveModule("Potenziali");
  }

  return (
    <main className={cn("min-h-screen", darkMode && "dark")}>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r bg-card/80 px-4 py-5 backdrop-blur lg:block">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">BASE</p>
              <h1 className="text-xl font-semibold">CRM</h1>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveModule(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                  activeModule === item.label
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 rounded-lg border bg-muted/45 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Enterprise ready
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Ruoli granulari, audit log, 2FA, backup e architettura modulare predisposta per API REST.
            </p>
          </div>
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              className="h-full w-72 border-r bg-card p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">BASE</p>
                    <p className="font-semibold">CRM</p>
                  </div>
                </div>
                <IconButton label="Chiudi menu" onClick={() => setMobileNavOpen(false)}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveModule(item.label);
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                      activeModule === item.label
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </motion.aside>
          </div>
        )}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b bg-background/88 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <IconButton label="Menu" onClick={() => setMobileNavOpen(true)}>
                <PanelLeft className="h-4 w-4" />
              </IconButton>
              <div className="min-w-[220px] flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cerca clienti, campagne, task, documenti..."
                    className="h-10 w-full rounded-lg border bg-card pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              </div>
              <IconButton
                label={`Filtro priorita: ${priorityFilter}`}
                onClick={() =>
                  setPriorityFilter((value) =>
                    value === "Tutte" ? "Alta" : value === "Alta" ? "Media" : value === "Media" ? "Bassa" : "Tutte"
                  )
                }
              >
                <Filter className="h-4 w-4" />
              </IconButton>
              <div className="relative">
                <IconButton label="Notifiche" onClick={() => setNotificationsOpen((value) => !value)}>
                  <Bell className="h-4 w-4" />
                </IconButton>
                {notificationsOpen && (
                  <Card className="absolute right-0 top-12 z-30 w-80 p-4">
                    <h3 className="mb-3 font-semibold">Notifiche</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>Attivita di oggi: {todayActivities.length}</p>
                      <p>Promemoria scaduti: {overdueActivities.length}</p>
                      <p>Follow-up aperti: {allActivities.filter(({ activity }) => isOpenActivity(activity)).length}</p>
                      <p>Post in approvazione: {socialItems.filter((post) => post.status === "In approvazione").length}</p>
                      <p>Spazi oltre 80%: {adSlots.filter((ad) => ad.booked >= 80).length}</p>
                    </div>
                  </Card>
                )}
              </div>
              <IconButton label={darkMode ? "Light mode" : "Dark mode"} onClick={() => setDarkMode((value) => !value)}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconButton>
              {process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && (
                <IconButton label="Esci" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </IconButton>
              )}
              <button
                onClick={() => setLeadModalOpen(true)}
                disabled={!canEditCrm}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {canEditCrm ? "Nuovo lead" : "Solo consultazione"}
              </button>
            </div>
          </header>

          {saveError && <p className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300 md:mx-6 xl:mx-8">{saveError}</p>}

          <div className="space-y-6 px-4 py-6 md:px-6 xl:px-8">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col justify-between gap-4 md:flex-row md:items-end"
            >
              <div>
                <p className="mb-2 text-sm font-medium text-primary">Marketing, vendite e redazione in un unico flusso</p>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                  Controllo completo su lead, pubblicita, servizi digitali e performance.
                </h2>
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                Q3 Commerciale
                <ChevronDown className="h-4 w-4" />
              </div>
            </motion.section>

            {activeModule !== "Dashboard" && (
              <Card>
                {activeModule === "Team" && (
                  <div>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-primary">{teamInfo?.teamName || "Team BASE"}</p>
                        <h3 className="text-lg font-semibold">Membri e ruoli</h3>
                        <p className="text-sm text-muted-foreground">Il CRM e condiviso con le persone di questo team.</p>
                      </div>
                      {teamInfo?.currentRole === "admin" && <button onClick={() => setMemberModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Aggiungi utente</button>}
                    </div>
                    {teamError && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{teamError}</p>}
                    {teamInfo ? <div className="space-y-3">
                      {teamInfo.members.map((member) => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4"><div><p className="font-semibold">{member.email}</p><p className="mt-1 text-sm text-muted-foreground">{roleDescriptions[member.role]}</p></div>{teamInfo.currentRole === "admin" ? <select aria-label={`Ruolo di ${member.email}`} value={member.role} onChange={(event) => void updateTeamRole(member.userId, event.target.value as TeamRole)} className="h-10 rounded-lg border bg-card px-3 text-sm font-medium">{(Object.keys(roleLabels) as TeamRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select> : <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{roleLabels[member.role]}</span>}</div>)}
                    </div> : !teamError && <p className="text-sm text-muted-foreground">Caricamento team...</p>}
                  </div>
                )}
                {activeModule === "Aziende" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Aziende</h3>
                        <p className="text-sm text-muted-foreground">{filteredClients.length} aziende con anagrafica, settore, indirizzo e storico collegato.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Filtra aziende per settore" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="h-10 max-w-48 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary">
                          <option>Tutti i settori</option>
                          {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                        </select>
                        <button disabled={!canEditCrm} onClick={() => setLeadModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
                          <Plus className="h-4 w-4" />
                          Nuova azienda
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {filteredClients.map((client) => (
                        <div key={client.id} className="rounded-lg border bg-background p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{client.company}</h4>
                              <p className="mt-1 text-sm text-muted-foreground">{client.sector || "Settore da qualificare"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{clientLocation(client) || "Indirizzo da aggiungere"}</p>
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{client.stage}</span>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                            <span>Contatto: {client.owner || "Da assegnare"}</span>
                            <span>Attivita: {(client.activityLog || []).length}</span>
                            <span>Opportunita: {client.value}</span>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => setSelectedClientId(client.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary">
                              <FileText className="h-3.5 w-3.5" />
                              Apri azienda
                            </button>
                          </div>
                        </div>
                      ))}
                      {!filteredClients.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground xl:col-span-2">Nessuna azienda per i filtri selezionati.</p>}
                    </div>
                  </div>
                )}

                {activeModule === "Contatti" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Contatti</h3>
                        <p className="text-sm text-muted-foreground">{filteredClients.length} referenti collegati alle aziende e alle opportunita.</p>
                      </div>
                      <button disabled={!canEditCrm} onClick={() => setLeadModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
                        <Plus className="h-4 w-4" />
                        Nuovo contatto
                      </button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Referente</th>
                            <th className="px-3 py-2 font-medium">Azienda</th>
                            <th className="px-3 py-2 font-medium">Email</th>
                            <th className="px-3 py-2 font-medium">Telefono</th>
                            <th className="px-3 py-2 font-medium">Settore</th>
                            <th className="px-3 py-2 font-medium">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredClients.map((client) => (
                            <tr key={client.id} className="border-t">
                              <td className="px-3 py-2 font-medium">{client.owner || "Da assegnare"}</td>
                              <td className="px-3 py-2">{client.company}</td>
                              <td className="px-3 py-2 text-muted-foreground">{client.email || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{client.phone || "-"}</td>
                              <td className="px-3 py-2">{client.sector || "Da qualificare"}</td>
                              <td className="px-3 py-2">
                                <button onClick={() => setSelectedClientId(client.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary">
                                  <FileText className="h-3.5 w-3.5" />
                                  Scheda
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!filteredClients.length && <p className="mt-3 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessun contatto per i filtri selezionati.</p>}
                  </div>
                )}

                {activeModule === "Opportunita" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Opportunità</h3>
                        <p className="text-sm text-muted-foreground">{filteredClients.length} trattative con valore, probabilita, servizi e stato pipeline.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Filtra opportunita per settore" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="h-10 max-w-48 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary">
                          <option>Tutti i settori</option>
                          {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                        </select>
                        <button disabled={!canEditCrm} onClick={() => setLeadModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
                          <Plus className="h-4 w-4" />
                          Nuova opportunità
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {filteredClients.map((client) => (
                        <div key={client.id} className="rounded-lg border bg-background p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{client.company}</h4>
                              <p className="mt-1 text-sm text-muted-foreground">{client.services.join(", ") || "Servizi da definire"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{client.owner || "Referente da assegnare"} · {client.nextFollowUp || "Follow-up non impostato"}</p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="font-semibold">{client.value}</p>
                              <p className="text-sm text-muted-foreground">{client.probability}% · {client.priority}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{client.stage}</span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{client.sector || "Da qualificare"}</span>
                            <button onClick={() => setSelectedClientId(client.id)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary">
                              <FileText className="h-3.5 w-3.5" />
                              Apri opportunità
                            </button>
                          </div>
                        </div>
                      ))}
                      {!filteredClients.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessuna opportunità per i filtri selezionati.</p>}
                    </div>
                  </div>
                )}

                {activeModule === "Potenziali" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Potenziali clienti</h3>
                        <p className="text-sm text-muted-foreground">{potentialClients.length} contatti da qualificare prima dell'appuntamento.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Filtra potenziali per settore" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="h-10 max-w-48 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary">
                          <option>Tutti i settori</option>
                          {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                        </select>
                        <button disabled={!canEditCrm} onClick={() => setImportModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                          <Upload className="h-4 w-4" />
                          Importa potenziali
                        </button>
                        <button disabled={!potentialClients.length || !canEditCrm} onClick={() => setClearPotentialsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/30 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                          <Trash2 className="h-4 w-4" />
                          Svuota potenziali
                        </button>
                        <button disabled={!canEditCrm} onClick={() => setLeadModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
                          <Plus className="h-4 w-4" />
                          Nuovo potenziale
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {potentialClients.map((client) => (
                        <div key={client.id} className="rounded-lg border bg-background p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{client.company}</h4>
                              <p className="text-sm text-muted-foreground">{client.sector} · {client.owner}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{client.email} · {client.phone}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{clientLocation(client) || "Indirizzo da aggiungere"}</p>
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{client.stage}</span>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button onClick={() => setActivityEntry({ clientId: client.id, type: "Email" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Email</button>
                            <button onClick={() => setActivityEntry({ clientId: client.id, type: "Telefonata" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Telefonata</button>
                            <button onClick={() => setActivityEntry({ clientId: client.id, type: "Visita" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Visita</button>
                            <button onClick={() => promotePotentialClient(client.id)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Conferma appuntamento
                            </button>
                            <button onClick={() => setSelectedClientId(client.id)} className="grid h-8 w-8 place-items-center rounded-lg border text-muted-foreground transition hover:text-primary" title="Apri scheda"><FileText className="h-4 w-4" /></button>
                          </div>
                          {(client.activityLog || []).length > 0 && <p className="mt-3 text-xs text-muted-foreground">Ultima attivita: {(client.activityLog || []).at(-1)?.type} · {(client.activityLog || []).at(-1)?.at} · {(client.activityLog || []).at(-1)?.by || "Non indicato"}</p>}
                        </div>
                      ))}
                      {!potentialClients.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessun potenziale cliente per i filtri selezionati.</p>}
                    </div>
                  </div>
                )}

                {activeModule === "Clienti" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Clienti acquisiti</h3>
                        <p className="text-sm text-muted-foreground">{actualClients.length} clienti con appuntamento confermato o trattativa in corso.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Filtra per settore"
                          value={sectorFilter}
                          onChange={(event) => setSectorFilter(event.target.value)}
                          className="h-10 max-w-48 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary"
                        >
                          <option>Tutti i settori</option>
                          {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                        </select>
                        <button onClick={() => { setActiveModule("Potenziali"); setLeadModalOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                          <Plus className="h-4 w-4" />
                          Nuovo potenziale
                        </button>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {Object.entries(clientsBySector).sort(([first], [second]) => first.localeCompare(second, "it")).map(([sector, clients]) => (
                        <section key={sector}>
                          <div className="mb-3 flex items-center justify-between border-b pb-2">
                            <h4 className="font-semibold">{sector}</h4>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{clients.length} attivita</span>
                          </div>
                          <div className="grid gap-3">
                            {clients.map((client) => (
                              <div key={client.id} className="rounded-lg border bg-background p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h4 className="font-semibold">{client.company}</h4>
                                    <p className="text-sm text-muted-foreground">{client.sector} · {client.owner}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{client.email} · {client.phone}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{clientLocation(client) || "Indirizzo da aggiungere"}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold">{client.value}</p>
                                    <p className="text-sm text-muted-foreground">{client.stage} · {client.probability}%</p>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{client.priority}</span>
                                  {client.services.map((service) => (
                                    <span key={service} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{service}</span>
                                  ))}
                                  <button onClick={() => setSelectedClientId(client.id)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary">
                                    <FileText className="h-3.5 w-3.5" />
                                    Apri scheda
                                  </button>
                                  <button onClick={() => setCrmClients((current) => current.filter((item) => item.id !== client.id))} className="grid h-8 w-8 place-items-center rounded-lg border text-muted-foreground transition hover:text-red-500" title="Elimina cliente">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                      {!actualClients.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessun cliente acquisito per i filtri selezionati.</p>}
                    </div>
                  </div>
                )}

                {activeModule === "Agenda" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Agenda attività</h3>
                        <p className="text-sm text-muted-foreground">{agendaActivities.length} attività filtrate, {todayActivities.length} da gestire oggi, {overdueActivities.length} scadute.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Filtra agenda per stato" value={agendaStatusFilter} onChange={(event) => setAgendaStatusFilter(event.target.value as typeof agendaStatusFilter)} className="h-10 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary">
                          <option>Aperte</option>
                          <option>Tutte</option>
                          {activityStatuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <select aria-label="Filtra agenda per settore" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="h-10 max-w-48 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:border-primary">
                          <option>Tutti i settori</option>
                          {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mb-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border bg-background p-4">
                        <p className="text-sm text-muted-foreground">Oggi</p>
                        <p className="mt-1 text-2xl font-semibold">{todayActivities.length}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-4">
                        <p className="text-sm text-muted-foreground">Scadute</p>
                        <p className="mt-1 text-2xl font-semibold text-red-600">{overdueActivities.length}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-4">
                        <p className="text-sm text-muted-foreground">Aperte</p>
                        <p className="mt-1 text-2xl font-semibold">{allActivities.filter(({ activity }) => isOpenActivity(activity)).length}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {agendaActivities.map(({ activity, client }) => {
                        const status = activity.status || (activity.dueDate ? "Programmata" : "Fatta");
                        const overdue = isOverdueActivity(activity);
                        const today = activityDateValue(activity) === todayValue();
                        return (
                          <div key={`${client.id}-${activity.id}`} className={cn("rounded-lg border bg-background p-4", overdue && "border-red-500/40 bg-red-500/5", today && !overdue && "border-primary/40")}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{activity.type}</span>
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{status}</span>
                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{activity.priority || client.priority}</span>
                                  {overdue && <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">Scaduta</span>}
                                  {today && !overdue && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Oggi</span>}
                                </div>
                                <button onClick={() => setSelectedClientId(client.id)} className="mt-2 text-left text-sm font-semibold transition hover:text-primary">{client.company}</button>
                                <p className="mt-1 text-xs text-muted-foreground">{client.sector} · {client.owner || "Referente da assegnare"} · {client.phone || "Telefono mancante"}</p>
                                {activity.notes && <p className="mt-2 text-sm text-muted-foreground">{activity.notes}</p>}
                              </div>
                              <div className="text-left text-sm md:text-right">
                                <p className="font-semibold">{activityDateTimeLabel(activity)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Promemoria: {activity.reminderAt || "Non impostato"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">A: {activity.assignedTo || activity.by || "Da assegnare"}</p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button disabled={!canEditCrm} onClick={() => void updateContactActivityStatus(client.id, activity.id, "Fatta")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Fatta
                              </button>
                              <button disabled={!canEditCrm} onClick={() => void updateContactActivityStatus(client.id, activity.id, "Rimandata")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                                <Timer className="h-3.5 w-3.5" />
                                Rimandata
                              </button>
                              <button disabled={!canEditCrm} onClick={() => void updateContactActivityStatus(client.id, activity.id, "Da fare")} className="h-8 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                                Riapri
                              </button>
                              <button onClick={() => setSelectedClientId(client.id)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:border-primary hover:text-primary">
                                <FileText className="h-3.5 w-3.5" />
                                Scheda
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!agendaActivities.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessuna attività in agenda per i filtri selezionati.</p>}
                    </div>
                  </div>
                )}

                {activeModule === "Pipeline" && (
                  <div>
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold">Pipeline drag & drop</h3>
                      <p className="text-sm text-muted-foreground">Trascina una card in una colonna per cambiare stato.</p>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-5">
                      {pipeline.map((stage) => (
                        <div
                          key={stage.stage}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => draggingClientId && moveClient(draggingClientId, stage.stage as StageName)}
                          className={cn("min-h-72 rounded-lg border bg-background p-3", draggingClientId && "ring-1 ring-primary/30")}
                        >
                          <div className={cn("mb-4 h-1.5 rounded-full", stage.color)} />
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold">{stage.stage}</h4>
                            <span className="rounded-full bg-muted px-2 py-1 text-xs">
                              {filteredClients.filter((client) => client.stage === stage.stage).length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {filteredClients
                              .filter((client) => client.stage === stage.stage)
                              .map((client) => (
                                <div
                                  key={client.id}
                                  draggable
                                  onDragStart={() => setDraggingClientId(client.id)}
                                  onDragEnd={() => setDraggingClientId(null)}
                                  className="cursor-grab rounded-lg border bg-card p-3 active:cursor-grabbing"
                                >
                                  <p className="text-sm font-semibold">{client.company}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{client.value} · {client.probability}%</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeModule === "Pubblicita" && (
                  <div>
                    <h3 className="mb-4 text-lg font-semibold">Gestione pubblicita</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      {adSlots.map((ad) => (
                        <div key={ad.id} className="rounded-lg border bg-background p-4">
                          <h4 className="font-semibold">{ad.slot}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">CTR {ad.ctr} · rinnovo {ad.renewal}</p>
                          <div className="my-4 h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${ad.booked}%` }} />
                          </div>
                          <button
                            onClick={() => setAdSlots((current) => current.map((item) => (item.id === ad.id ? { ...item, booked: Math.min(100, item.booked + 8) } : item)))}
                            className="h-10 w-full rounded-lg border text-sm font-semibold"
                          >
                            Prenota +8%
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeModule === "Social" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Calendario social</h3>
                        <p className="text-sm text-muted-foreground">Clicca un contenuto per avanzare nel workflow.</p>
                      </div>
                      <button
                        onClick={() =>
                          setSocialItems((current) => [
                            { id: `s-${crypto.randomUUID()}`, title: "Nuova campagna editoriale", channel: "Instagram", status: "Bozza", date: "Da pianificare" },
                            ...current
                          ])
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        Nuovo post
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {(["Bozza", "In approvazione", "Programmato", "Pubblicato"] as SocialPost["status"][]).map((status) => (
                        <div key={status} className="rounded-lg border bg-background p-3">
                          <h4 className="mb-3 font-semibold">{status}</h4>
                          <div className="space-y-3">
                            {socialItems.filter((post) => post.status === status).map((post) => (
                              <button
                                key={post.id}
                                onClick={() =>
                                  setSocialItems((current) =>
                                    current.map((item) =>
                                      item.id === post.id
                                        ? {
                                            ...item,
                                            status:
                                              item.status === "Bozza"
                                                ? "In approvazione"
                                                : item.status === "In approvazione"
                                                  ? "Programmato"
                                                  : item.status === "Programmato"
                                                    ? "Pubblicato"
                                                    : "Bozza"
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="w-full rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary"
                              >
                                <span className="font-semibold">{post.title}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">{post.channel} · {post.date}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeModule === "SEO" && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {["Keyword monitorate", "Core Web Vitals", "Traffico organico"].map((metric, index) => (
                      <div key={metric} className="rounded-lg border bg-background p-4">
                        <Globe2 className="mb-4 h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{metric}</h3>
                        <p className="mt-2 text-3xl font-semibold">{index === 0 ? filteredClients.length * 24 : index === 1 ? "87%" : "+18%"}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Dato operativo aggregato sui clienti filtrati.</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeModule === "Documenti" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Documenti e report</h3>
                        <p className="text-sm text-muted-foreground">Genera un report TXT scaricabile dai dati filtrati.</p>
                      </div>
                      <button onClick={downloadReport} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                        <Download className="h-4 w-4" />
                        Scarica report
                      </button>
                    </div>
                    <div className="grid gap-3">
                      {filteredClients.map((client) => (
                        <div key={client.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
                          <div>
                            <p className="font-semibold">Preventivo - {client.company}</p>
                            <p className="text-sm text-muted-foreground">{client.services.join(", ")} · {client.value}</p>
                          </div>
                          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">Bozza</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeModule === "AI Studio" && (
                  <div className="grid gap-6 xl:grid-cols-[0.55fr_1fr]">
                    <div>
                      <h3 className="mb-4 text-lg font-semibold">Azioni AI</h3>
                      <div className="space-y-3">
                        {aiActions.map((action) => (
                          <button key={action} onClick={() => runAi(action)} className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-3 text-left text-sm transition hover:border-primary">
                            {action}
                            <Sparkles className="h-4 w-4 text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Output generato</h3>
                      </div>
                      <pre className="whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-6 text-muted-foreground">{aiResult}</pre>
                    </div>
                  </div>
                )}
              </Card>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {liveKpis.map((kpi, index) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card>
                    <div className="mb-5 flex items-center justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
                        <kpi.icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                        {kpi.change}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-3xl font-semibold">{kpi.value}</p>
                  </Card>
                </motion.div>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Pipeline commerciale</h3>
                    <p className="text-sm text-muted-foreground">{totalPipeline} opportunita filtrate tra advertising e servizi digitali</p>
                  </div>
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {pipeline.map((stage) => {
                    const stageClients = filteredClients.filter((client) => client.stage === stage.stage);
                    return (
                    <div key={stage.stage} className="rounded-lg border bg-background p-3">
                      <div className={cn("mb-4 h-1.5 rounded-full", stage.color)} />
                      <p className="text-sm font-semibold">{stage.stage}</p>
                      <p className="mt-1 text-2xl font-semibold">{stageClients.length}</p>
                      <p className="text-sm text-muted-foreground">
                        € {new Intl.NumberFormat("it-IT").format(stageClients.reduce((sum, client) => sum + Number(client.value.replace(/[^0-9]/g, "")), 0))}
                      </p>
                    </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">AI integrata</h3>
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-3">
                  {aiActions.map((action) => (
                    <button key={action} onClick={() => runAi(action)} className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-3 text-left text-sm transition hover:border-primary">
                      {action}
                      <Sparkles className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                </div>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Clienti prioritari</h3>
                    <p className="text-sm text-muted-foreground">Schede CRM con opportunita, tag e servizi collegati</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-3">
                  {filteredClients.slice(0, 5).map((client) => (
                    <div key={client.company} className="rounded-lg border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{client.company}</h4>
                          <p className="text-sm text-muted-foreground">{client.sector} · referente {client.owner}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{client.value}</p>
                          <p className="text-sm text-muted-foreground">{client.probability}% chiusura</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {client.services.map((service) => (
                          <span key={service} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-6">
                <Card>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Spazi pubblicitari</h3>
                    <Megaphone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-4">
                    {adSlots.map((ad) => (
                      <div key={ad.slot}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium">{ad.slot}</span>
                          <span className="text-muted-foreground">CTR {ad.ctr}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${ad.booked}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Rinnovo tra {ad.renewal}</p>
                        <button
                          onClick={() =>
                            setAdSlots((current) =>
                              current.map((item) => (item.id === ad.id ? { ...item, booked: Math.min(100, item.booked + 8) } : item))
                            )
                          }
                          className="mt-3 h-9 rounded-lg border px-3 text-xs font-semibold"
                        >
                          Prenota spazio
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Calendario social</h3>
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-3">
                    {socialItems.map((post) => (
                      <button
                        key={post.id}
                        onClick={() =>
                          setSocialItems((current) =>
                            current.map((item) =>
                              item.id === post.id
                                ? {
                                    ...item,
                                    status:
                                      item.status === "Bozza"
                                        ? "In approvazione"
                                        : item.status === "In approvazione"
                                          ? "Programmato"
                                          : item.status === "Programmato"
                                            ? "Pubblicato"
                                            : "Bozza"
                                  }
                                : item
                            )
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary"
                      >
                        <div>
                          <p className="text-sm font-semibold">{post.title}</p>
                          <p className="text-xs text-muted-foreground">{post.channel} · {post.date}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{post.status}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <Card>
                <Mail className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-semibold">Email e automazioni</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Template, tracking aperture, click, follow-up automatici e sincronizzazione Gmail/Microsoft 365.
                </p>
              </Card>
              <Card>
                <Phone className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-semibold">Telefonate e task</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Registro chiamate, esiti, promemoria, checklist, priorita e assegnazione al team.
                </p>
              </Card>
              <Card>
                <CheckCircle2 className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-semibold">Report e documenti</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Preventivi, contratti, PDF, Excel, report ROI e storico versioni per ogni cliente.
                </p>
              </Card>
            </section>
          </div>
        </section>
      </div>

      {activityEntry && activityClient && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-soft">
            <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-primary">Registra attivita</p><h2 className="mt-1 text-xl font-semibold">{activityEntry.type} · {activityClient.company}</h2></div><IconButton label="Chiudi registrazione attività" onClick={() => setActivityEntry(null)}><X className="h-4 w-4" /></IconButton></div>
            <form onSubmit={saveContactActivity} className="grid gap-4 md:grid-cols-2">
              <Field label="Data attività"><input required name="date" type="date" className={inputClass} defaultValue={todayValue()} /></Field>
              <Field label="Operatore"><input required name="by" className={inputClass} placeholder="Chi ha svolto l'attivita" /></Field>
              <Field label="Settore attività"><input name="sector" className={inputClass} defaultValue={activityClient.sector || "Da qualificare"} /></Field>
              <Field label="Assegnata a"><input name="assignedTo" className={inputClass} defaultValue={activityClient.owner || ""} placeholder="Persona responsabile" /></Field>
              <Field label="Priorità"><select name="priority" defaultValue={activityClient.priority || "Media"} className={inputClass}><option>Alta</option><option>Media</option><option>Bassa</option></select></Field>
              <Field label="Esito"><select name="outcome" defaultValue="Da definire" className={inputClass}>{activityOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}</select></Field>
              <Field label="Scadenza agenda"><input name="dueDate" type="date" className={inputClass} defaultValue={activityClient.nextFollowUp || ""} /></Field>
              <Field label="Ora"><input name="dueTime" type="time" className={inputClass} /></Field>
              <Field label="Promemoria"><input name="reminderAt" type="date" className={inputClass} /></Field>
              <Field label="Stato"><select name="status" defaultValue={activityEntry.type === "Appuntamento" ? "Programmata" : "Da fare"} className={inputClass}>{activityStatuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
              <label className="grid gap-1.5 text-sm font-medium md:col-span-2"><span>Note</span><textarea required name="notes" className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" placeholder="Esito, richiesta del contatto, prossimo passo..." /></label>
              <div className="flex justify-end gap-3 md:col-span-2"><button type="button" onClick={() => setActivityEntry(null)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button><button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Salva attività</button></div>
            </form>
          </motion.div>
        </div>
      )}

      {memberModalOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-soft">
            <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-primary">Team BASE</p><h2 className="mt-1 text-xl font-semibold">Aggiungi utente</h2></div><IconButton label="Chiudi" onClick={() => setMemberModalOpen(false)}><X className="h-4 w-4" /></IconButton></div>
            <form onSubmit={addTeamMember} className="grid gap-4">
              <Field label="Email"><input required name="email" type="email" className={inputClass} placeholder="collega@azienda.it" /></Field>
              <Field label="Password temporanea"><input required minLength={8} name="password" type="password" className={inputClass} placeholder="Almeno 8 caratteri" /></Field>
              <Field label="Ruolo"><select name="role" defaultValue="commerciale" className={inputClass}>{(Object.keys(roleLabels) as TeamRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></Field>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setMemberModalOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button><button disabled={memberSaving} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{memberSaving ? "Creazione..." : "Crea utente"}</button></div>
            </form>
          </motion.div>
        </div>
      )}

      {clearPotentialsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-lg border bg-card p-5 shadow-soft">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <h2 className="text-xl font-semibold">Svuotare tutti i potenziali?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Verranno eliminati {potentialClients.length} potenziali clienti e le loro attivita di contatto. I clienti con appuntamento confermato resteranno invariati. Questa azione non puo essere annullata.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setClearPotentialsOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button>
              <button onClick={clearAllPotentials} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white"><Trash2 className="h-4 w-4" />Elimina potenziali</button>
            </div>
          </motion.div>
        </div>
      )}

      {selectedClient && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg border bg-card p-5 shadow-soft"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary">Scheda cliente</p>
                <h2 className="mt-1 text-xl font-semibold">{selectedClient.company}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Aggiorna contatto, opportunita, pipeline, servizi e note operative.</p>
              </div>
              <IconButton label="Chiudi scheda cliente" onClick={() => setSelectedClientId(null)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="mb-5 rounded-lg border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Cronologia contatti e agenda</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setActivityEntry({ clientId: selectedClient.id, type: "Email" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Email</button><button type="button" onClick={() => setActivityEntry({ clientId: selectedClient.id, type: "Telefonata" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Telefonata</button><button type="button" onClick={() => setActivityEntry({ clientId: selectedClient.id, type: "Visita" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Visita</button><button type="button" onClick={() => setActivityEntry({ clientId: selectedClient.id, type: "Appuntamento" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Appuntamento</button><button type="button" onClick={() => setActivityEntry({ clientId: selectedClient.id, type: "Promemoria" })} className="h-8 rounded-lg border px-3 text-xs font-semibold">Promemoria</button></div></div>
              {(selectedClient.activityLog || []).length > 0 ? <div className="space-y-2">
                {[...(selectedClient.activityLog || [])].reverse().map((activity) => <div key={activity.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{activity.type}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{activity.status || (activity.dueDate ? "Programmata" : "Fatta")}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{activity.priority || selectedClient.priority}</span></div><span className="text-muted-foreground">{activityDateTimeLabel(activity)} · {activity.by || "Non indicato"}</span></div><div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3"><span>Esito: {activity.outcome || "Da definire"}</span><span>A: {activity.assignedTo || activity.by || "Da assegnare"}</span><span>Promemoria: {activity.reminderAt || "Non impostato"}</span></div>{activity.notes && <p className="mt-2 text-muted-foreground">{activity.notes}</p>}</div>)}
              </div> : <p className="text-sm text-muted-foreground">Nessuna attivita registrata.</p>}
            </div>
            <form key={selectedClient.id} onSubmit={saveClientDetails} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm font-semibold">Azienda</p>
                <p className="text-xs text-muted-foreground">Dati anagrafici e sede operativa.</p>
              </div>
              <Field label="Ragione sociale">
                <input required name="company" className={inputClass} defaultValue={selectedClient.company} />
              </Field>
              <Field label="Settore">
                <input name="sector" className={inputClass} defaultValue={selectedClient.sector} />
              </Field>
              <Field label="Indirizzo">
                <input name="address" className={inputClass} defaultValue={selectedClient.address || ""} placeholder="Via o piazza" />
              </Field>
              <Field label="Numero civico">
                <input name="houseNumber" className={inputClass} defaultValue={selectedClient.houseNumber || ""} placeholder="Es. 12/A" />
              </Field>
              <Field label="Citta">
                <input name="city" className={inputClass} defaultValue={selectedClient.city || ""} placeholder="Es. Livorno" />
              </Field>
              <div className="hidden md:block" />
              <div className="border-t pt-4 md:col-span-2">
                <p className="text-sm font-semibold">Contatto</p>
                <p className="text-xs text-muted-foreground">Referente principale collegato all'azienda.</p>
              </div>
              <Field label="Referente">
                <input name="owner" className={inputClass} defaultValue={selectedClient.owner} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} defaultValue={selectedClient.email} />
              </Field>
              <Field label="Telefono">
                <input name="phone" className={inputClass} defaultValue={selectedClient.phone} />
              </Field>
              <div className="border-t pt-4 md:col-span-2">
                <p className="text-sm font-semibold">Opportunità</p>
                <p className="text-xs text-muted-foreground">Valore, probabilita, stato pipeline e servizi proposti.</p>
              </div>
              <Field label="Valore opportunita">
                <input name="value" type="number" min="0" className={inputClass} defaultValue={selectedClient.value.replace(/[^0-9]/g, "")} />
              </Field>
              <Field label="Probabilita">
                <input name="probability" type="number" min="1" max="100" className={inputClass} defaultValue={selectedClient.probability} />
              </Field>
              <Field label="Priorita">
                <select name="priority" className={inputClass} defaultValue={selectedClient.priority}>
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Bassa</option>
                </select>
              </Field>
              <Field label="Stato pipeline">
                <select name="stage" className={inputClass} defaultValue={selectedClient.stage}>
                  {stageNames.map((stage) => <option key={stage}>{stage}</option>)}
                </select>
              </Field>
              <Field label="Prossimo follow-up">
                <input name="nextFollowUp" type="date" className={inputClass} defaultValue={selectedClient.nextFollowUp} />
              </Field>
              <Field label="Servizi">
                <input name="services" className={inputClass} defaultValue={selectedClient.services.join(", ")} placeholder="SEO, Banner, Meta Ads" />
              </Field>
              <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
                <span>Note</span>
                <textarea name="notes" defaultValue={selectedClient.notes} className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" />
              </label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <button type="button" onClick={() => setSelectedClientId(null)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button>
                <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Salva modifiche</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {leadModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg border bg-card p-5 shadow-soft"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Nuovo lead</h2>
                <p className="text-sm text-muted-foreground">Il contatto entra subito in pipeline e resta salvato nel browser.</p>
              </div>
              <IconButton label="Chiudi" onClick={() => setLeadModalOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <form onSubmit={addLead} className="grid gap-4 md:grid-cols-2">
              <Field label="Ragione sociale">
                <input required name="company" className={inputClass} placeholder="Es. Studio Rossi" />
              </Field>
              <Field label="Settore">
                <input name="sector" className={inputClass} placeholder="Es. Immobiliare" />
              </Field>
              <Field label="Referente">
                <input name="owner" className={inputClass} placeholder="Nome referente" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} placeholder="nome@azienda.it" />
              </Field>
              <Field label="Telefono">
                <input name="phone" className={inputClass} placeholder="+39 ..." />
              </Field>
              <Field label="Indirizzo">
                <input name="address" className={inputClass} placeholder="Via o piazza" />
              </Field>
              <Field label="Numero civico">
                <input name="houseNumber" className={inputClass} placeholder="Es. 12/A" />
              </Field>
              <Field label="Citta">
                <input name="city" className={inputClass} placeholder="Es. Livorno" />
              </Field>
              <Field label="Valore opportunita">
                <input name="value" type="number" min="0" className={inputClass} defaultValue="5000" />
              </Field>
              <Field label="Probabilita">
                <input name="probability" type="number" min="1" max="100" className={inputClass} defaultValue="25" />
              </Field>
              <Field label="Priorita">
                <select name="priority" className={inputClass} defaultValue="Media">
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Bassa</option>
                </select>
              </Field>
              <Field label="Prossimo follow-up">
                <input name="nextFollowUp" type="date" className={inputClass} />
              </Field>
              <Field label="Servizi">
                <input name="services" className={inputClass} placeholder="SEO, Banner, Meta Ads" />
              </Field>
              <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
                <span>Note</span>
                <textarea name="notes" className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" />
              </label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <button type="button" onClick={() => setLeadModalOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">
                  Annulla
                </button>
                <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  Salva lead
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg border bg-card p-5 shadow-soft"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Importa lead</h2>
                <p className="mt-1 text-sm text-muted-foreground">Carica un file Excel moderno o testo delimitato. Le colonne vengono riconosciute automaticamente.</p>
              </div>
              <IconButton label="Chiudi importazione" onClick={() => setImportModalOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background px-5 py-8 text-center transition hover:border-primary">
              <Upload className="h-6 w-6 text-primary" />
              <span className="font-semibold">Seleziona un file da importare</span>
              <span className="text-sm text-muted-foreground">Formati supportati: .xlsx, .csv, .tsv</span>
              <input className="sr-only" type="file" accept=".xlsx,.csv,.tsv,text/csv,text/tab-separated-values" onChange={previewLeadImport} />
            </label>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">Colonne riconosciute: Azienda o Ragione sociale, Settore, Referente, Email, Telefono, Indirizzo, Civico, Citta, Valore, Probabilita, Priorita, Stato, Servizi, Follow-up e Note.</p>

            {importError && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{importError}</p>}

            {importPreview.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Anteprima importazione</h3>
                    <p className="text-sm text-muted-foreground">{importFileName}: {importPreview.length} lead rilevati. I duplicati per azienda ed email verranno ignorati.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{importPreview.length} pronti</span>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Azienda</th>
                        <th className="px-3 py-2 font-medium">Referente</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Valore</th>
                        <th className="px-3 py-2 font-medium">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 50).map((lead) => (
                        <tr key={lead.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{lead.company}</td>
                          <td className="px-3 py-2">{lead.owner}</td>
                          <td className="px-3 py-2 text-muted-foreground">{lead.email || "-"}</td>
                          <td className="px-3 py-2">{lead.value}</td>
                          <td className="px-3 py-2">{lead.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.length > 50 && <p className="mt-2 text-xs text-muted-foreground">Visualizzate le prime 50 righe.</p>}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setImportModalOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button>
              <button disabled={!importPreview.length} onClick={importLeads} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                <Upload className="h-4 w-4" />
                Importa {importPreview.length || ""} lead
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
