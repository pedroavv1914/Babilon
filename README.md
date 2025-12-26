# 💰 Babilon — Frontend

Personal finance web app built with **React + Vite + Tailwind**, powered by **Supabase** (Auth + Postgres).

This folder contains the **frontend SPA** (Single Page Application). The app currently talks to Supabase directly from the browser and relies on **Row Level Security (RLS)** to isolate each user's data.

## 🧭 Contents

- [✨ Features](#-features)
- [🧰 Tech stack](#-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [🧩 Pages & routes](#-pages--routes)
- [📁 Project structure](#-project-structure)
- [🧪 Supabase requirements](#-supabase-requirements)
- [🔐 Environment variables](#-environment-variables)
- [🚀 Running locally](#-running-locally)
- [📦 Build](#-build)
- [🌍 Deployment notes](#-deployment-notes)
- [🛡️ Security notes](#️-security-notes)
- [🧯 Troubleshooting](#-troubleshooting)

## ✨ Features

- 🔐 **Sign in / sign up** with Supabase Auth
- 📊 **Dashboard** with monthly summary + budget usage charts
- 💵 **Incomes**: register monthly income
- 🎯 **Budgets**: monthly spending limits per category
- 🧾 **Transactions**: expenses, reserve allocations, and credit card bill payments
- 🏷️ **Categories**: organize budgets and transactions
- 🧰 **Emergency reserve** progress (shown on the dashboard)
- 📈 **Investments**: register simple investment entries
- 🚨 **Alerts**: budget warning/critical alerts in the UI

## 🧰 Tech stack

- ⚛️ React 18
- ⚡ Vite 5
- 🎨 Tailwind CSS 3
- 🟩 Supabase JS v2 (`@supabase/supabase-js`)
- 🧭 React Router DOM v6
- 📉 Recharts

## 🏗️ Architecture

- 🔐 **Authentication**: handled by Supabase Auth.
- 🗄️ **Data access**: the app uses the Supabase client directly:
  - 👤 The current user id is read via `supabase.auth.getUser()` ([auth.ts](file:///c:/Users/pedro/Desktop/PEDRO/C%C3%B3digos/Projetos/Projeto%20Babilon/frontend/src/lib/auth.ts)).
  - 🔁 Database reads/writes happen via `supabase.from(...).select/insert/delete(...)`.
- 🔔 **Realtime refresh**: some pages subscribe to Postgres changes (e.g., `transactions`, `alerts`) and reload UI data.
- 📊 **Charts**: dashboard/budget usage and transaction distribution use Recharts.

## 🧩 Pages & routes

Routes are defined in [App.tsx](file:///c:/Users/pedro/Desktop/PEDRO/C%C3%B3digos/Projetos/Projeto%20Babilon/frontend/src/App.tsx):

- 🔐 `/login` — login
- 📝 `/register` — registration
- 🏠 `/` — dashboard
- ⚙️ `/settings` — user settings
- 💵 `/incomes` — monthly incomes
- 🏷️ `/categories` — categories
- 🎯 `/budgets` — budgets
- 🧾 `/transactions` — transactions
- 📈 `/investments` — investments

## 📁 Project structure

```
frontend/
  src/
    components/     UI building blocks (Header, Footer, TipsPanel)
    lib/            Supabase client + small auth helpers
    pages/          Route-level screens
    styles/         Global styles (Tailwind)
    App.tsx         Routing + session bootstrap
    main.tsx        App entry
```

## 🧪 Supabase requirements

The UI expects a Supabase project with tables/views for finance tracking (at minimum: `categories`, `budgets`, `transactions`, `alerts`, `incomes`, `emergency_reserve`, plus reporting views used by the dashboard such as `vw_budget_usage` and `vw_monthly_summary`).

✅ All tables must enforce **RLS** so that each user can only access their own records.

The SQL sources for your backend schema live in this repository under `../backend/sql/`.

## 🔐 Environment variables

Create a `.env` file in `frontend/` (you can start from `.env.example`) and set:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon public key

These variables are read in [supabaseClient.ts](file:///c:/Users/pedro/Desktop/PEDRO/C%C3%B3digos/Projetos/Projeto%20Babilon/frontend/src/lib/supabaseClient.ts).

## 🚀 Running locally

From the `frontend/` folder:

```bash
npm install
npm run dev
```

Then open the URL shown by Vite (usually `http://localhost:5173`).

## 📦 Build

```bash
npm run build
npm run preview
```

## 🌍 Deployment notes

Because this is a SPA:

- 🧭 Configure **SPA fallback** (rewrite all routes to `index.html`).
- 🔐 Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as production environment variables.

On Supabase, ensure **Auth URL settings** match your deployed domain:

- ⚙️ Auth → URL Configuration → `Site URL`
- 🔁 Auth → URL Configuration → `Redirect URLs` (include your `/login` and `/register` routes)

## 🛡️ Security notes

- 🟩 The anon key is public by design. Your protection is **RLS** + correct policies on every table.
- 🔒 Never store third-party secrets (API keys, OAuth client secrets, service role keys) in the frontend. Those belong in a server/edge function.

## 🧯 Troubleshooting

- 🔁 **Login redirects fail in production**: check Supabase `Site URL` and `Redirect URLs`.
- ⛔ **Insert/select returns “permission denied”**: your RLS policies are blocking the operation.
- 📡 **Realtime not updating UI**: ensure Realtime is enabled for the tables you subscribe to in Supabase.
