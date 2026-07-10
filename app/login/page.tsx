"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const result = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div>
          <div><p className="text-sm text-muted-foreground">BASE</p><h1 className="text-xl font-semibold">CRM</h1></div>
        </div>
        <div className="mb-6"><LockKeyhole className="mb-3 h-5 w-5 text-primary" /><h2 className="text-2xl font-semibold">Accedi</h2><p className="mt-1 text-sm text-muted-foreground">Area riservata al team.</p></div>
        {!configured ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">Supabase non e configurato. Imposta le variabili d'ambiente prima del deploy.</p> : <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">Email<input required name="email" type="email" autoComplete="email" className="h-10 rounded-lg border bg-background px-3 outline-none focus:border-primary" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Password<input required name="password" type="password" minLength={8} autoComplete="current-password" className="h-10 rounded-lg border bg-background px-3 outline-none focus:border-primary" /></label>
          {message && <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
          <button disabled={loading} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{loading ? "Attendi..." : "Accedi"}</button>
          <p className="text-center text-sm text-muted-foreground">Per ottenere un accesso, contatta l'amministratore.</p>
        </form>}
      </section>
    </main>
  );
}
