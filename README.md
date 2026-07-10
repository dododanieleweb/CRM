# BASE CRM

Web app CRM professionale per agenzia marketing e quotidiano online.

## Stack previsto

- Next.js, React, TypeScript
- TailwindCSS, componenti in stile shadcn/ui
- Framer Motion
- React Query
- Backend previsto: NestJS, PostgreSQL, Prisma, Redis, storage S3 compatibile

## Avvio

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`.

## Supabase e Netlify

1. Crea un progetto Supabase e apri SQL Editor.
2. Esegui nell'ordine `supabase/migrations/20260710_create_crm_state.sql` e `supabase/migrations/20260710_add_team_roles.sql`.
3. Copia `.env.example` in `.env.local` e inserisci URL, publishable key e service role key del progetto Supabase.
4. Su Netlify collega il repository e imposta `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nella configurazione del sito.
5. Netlify usa `npm run build` e pubblica l'app Next.js secondo `netlify.toml`.
6. In Supabase, Authentication > URL Configuration, imposta Site URL sull'URL Netlify e aggiungi `https://tuo-sito.netlify.app/auth/confirm` alle Redirect URLs. Con il piano Free puoi lasciare invariato il template email standard.

La chiave `SUPABASE_SERVICE_ROLE_KEY` deve restare esclusivamente nelle variabili server di Netlify e non va mai inserita in file client o nel repository.

Il CRM usa Supabase Auth con email e password. Il middleware richiede una sessione valida per la web app e l'API CRM. I dati sono condivisi tra i membri dello stesso team: l'Admin puo creare utenti e assegnare ruoli dalla sezione Team.

Per rendere il CRM privato, disattiva `Allow new users to sign up` in Supabase, sezione Authentication > General Configuration. Il primo utente gia presente diventa Admin dopo l'esecuzione della seconda migrazione; potra creare gli altri utenti dalla sezione Team.

## Moduli inclusi nella prima vertical slice

- Dashboard KPI
- Pipeline commerciale
- CRM clienti prioritari
- Gestione spazi pubblicitari
- Calendario social
- AI Studio
- Email, task, telefonate, report e documenti
- Light mode / dark mode
- Layout responsive desktop, tablet e mobile
