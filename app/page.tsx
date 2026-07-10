"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
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
  { label: "Clienti", icon: Users },
  { label: "Pipeline", icon: Workflow },
  { label: "Pubblicita", icon: Megaphone },
  { label: "Social", icon: CalendarDays },
  { label: "SEO", icon: Globe2 },
  { label: "Documenti", icon: FileText },
  { label: "AI Studio", icon: Bot }
];

type StageName = "Lead" | "Contattato" | "Telefonata" | "Appuntamento" | "Preventivo" | "Trattativa" | "Contratto";

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
  nextFollowUp: string;
  notes: string;
};

const stageNames: StageName[] = ["Lead", "Contattato", "Telefonata", "Appuntamento", "Preventivo", "Trattativa", "Contratto"];

const headerAliases: Record<keyof Omit<Client, "id" | "services">, string[]> = {
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
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clearClientsOpen, setClearClientsOpen] = useState(false);
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

  const clientsBySector = useMemo(() => {
    return filteredClients.reduce<Record<string, Client[]>>((groups, client) => {
      const sector = client.sector || "Da qualificare";
      groups[sector] = [...(groups[sector] || []), client];
      return groups;
    }, {});
  }, [filteredClients]);

  const selectedClient = useMemo(
    () => crmClients.find((client) => client.id === selectedClientId) ?? null,
    [crmClients, selectedClientId]
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
      nextFollowUp: String(form.get("nextFollowUp") || ""),
      notes: String(form.get("notes") || "")
    };

    const nextClients = [newClient, ...crmClients];
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;

    setCrmClients(nextClients);
    setLeadModalOpen(false);
    setActiveModule("Clienti");
    event.currentTarget.reset();
  }

  async function saveClientDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      nextFollowUp: String(form.get("nextFollowUp") || ""),
      notes: String(form.get("notes") || "")
    };
    const nextClients = crmClients.map((client) => client.id === updatedClient.id ? updatedClient : client);
    const saved = await persistCrmState({ darkMode, crmClients: nextClients, socialItems, adSlots });
    if (!saved) return;

    setCrmClients(nextClients);
    setSelectedClientId(null);
  }

  async function clearAllClients() {
    const saved = await persistCrmState({ darkMode, crmClients: [], socialItems, adSlots });
    if (!saved) return;
    setCrmClients([]);
    setSelectedClientId(null);
    setSectorFilter("Tutti i settori");
    setClearClientsOpen(false);
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
          const rawStage = String(read("stage")).trim();
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
            stage: stageNames.includes(rawStage as StageName) ? (rawStage as StageName) : "Lead",
            services: String(servicesValue).split(/[,;|]/).map((service) => service.trim()).filter(Boolean),
            nextFollowUp: String(read("nextFollowUp")).trim(),
            notes: String(read("notes")).trim()
          } satisfies Client;
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
                      <p>Follow-up aperti: {filteredClients.filter((client) => client.nextFollowUp).length}</p>
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
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Nuovo lead
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
                {activeModule === "Clienti" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">CRM clienti</h3>
                        <p className="text-sm text-muted-foreground">{filteredClients.length} schede trovate con ricerca e filtro attivi</p>
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
                        <button onClick={() => setImportModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition hover:border-primary hover:text-primary">
                          <Upload className="h-4 w-4" />
                          Importa lead
                        </button>
                        <button disabled={!crmClients.length} onClick={() => setClearClientsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/30 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                          <Trash2 className="h-4 w-4" />
                          Svuota clienti
                        </button>
                        <button onClick={() => setLeadModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                          <Plus className="h-4 w-4" />
                          Aggiungi cliente
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
                      {!filteredClients.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nessuna attivita trovata per i filtri selezionati.</p>}
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

      {clearClientsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-lg border bg-card p-5 shadow-soft">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <h2 className="text-xl font-semibold">Svuotare tutti i clienti?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Verranno eliminati {crmClients.length} clienti e le relative opportunita dalla lista CRM. Questa azione non puo essere annullata.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setClearClientsOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Annulla</button>
              <button onClick={clearAllClients} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white"><Trash2 className="h-4 w-4" />Elimina tutti</button>
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
            <form key={selectedClient.id} onSubmit={saveClientDetails} className="grid gap-4 md:grid-cols-2">
              <Field label="Ragione sociale">
                <input required name="company" className={inputClass} defaultValue={selectedClient.company} />
              </Field>
              <Field label="Settore">
                <input name="sector" className={inputClass} defaultValue={selectedClient.sector} />
              </Field>
              <Field label="Referente">
                <input name="owner" className={inputClass} defaultValue={selectedClient.owner} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} defaultValue={selectedClient.email} />
              </Field>
              <Field label="Telefono">
                <input name="phone" className={inputClass} defaultValue={selectedClient.phone} />
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
