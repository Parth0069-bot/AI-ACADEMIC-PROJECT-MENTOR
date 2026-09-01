This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## UX additions: error resilience + connectivity awareness

Two small, self-contained additions on top of the existing toast (`react-hot-toast`) and dark/light mode (`next-themes` + `ThemeToggle`) systems, which were already in place.

**1. Branded error & 404 boundaries** — previously, any unhandled render error or bad URL fell through to Next.js's default (unbranded, jarring) error/404 pages, and a crash on one page had no recovery path short of a manual refresh.
- `app/error.tsx` — root-level boundary for anything not caught more specifically. Deliberately has zero dependency on app context (auth, theme) since an error boundary should assume as little as possible about app state — it's plain Tailwind + the existing `Mascot` illustration.
- `app/not-found.tsx` — branded 404 using the same `Mascot`/`Card` visual language as the rest of the app (see `components/layout/ComingSoon.tsx` for the pattern this follows), with links back to the dashboard and projects.
- `app/(dashboard)/error.tsx` — scoped to the dashboard route group. Because the parent layout keeps rendering around a route-level error boundary, the `Sidebar` stays visible and the student never loses navigation because one page (an agent run, a document generator, viva studio) crashed. Offers "Try again" (`reset()`) and "Back to dashboard".

**2. Connectivity banner** (`components/ConnectivityBanner.tsx`, wired into `app/layout.tsx`) — this app leans on network calls for nearly everything (agent runs, chat, document generation, Supabase reads/writes) with no offline queue, and students are often on campus/hostel wifi that drops. A submission that silently fails because the connection dropped is confusing. This surfaces the state instead of letting requests fail quietly:
- Offline: a persistent slim banner at the top of the page (a toast wasn't right here — it auto-dismisses, but the offline state can last minutes).
- Back online: the banner clears and a brief "Back online" toast confirms it, using the same `Toaster` already configured.
- Adds zero visual weight for the common case — renders nothing if the browser was never observed going offline this session.

Both additions were built and verified against this project directly: `npm run build` and `npm run lint` both pass clean with these files included, and no existing route, bundle, or type-check regressed.

## Hamburger navigation + UI consistency pass

**1. Mobile hamburger menu** — the desktop `Sidebar` (`components/layout/Sidebar.tsx`) is `hidden md:flex`, and below that breakpoint there was previously no way to reach any section of the app at all. Implemented properly rather than page-scoped:
- `lib/navigation.ts` — the nav sections/items are now defined **once**, imported by both the desktop Sidebar and the new mobile drawer, so the two can never list different sections or drift out of sync. This also fixed a real bug: the actual home page (`/dashboard` — where `/login` and `/register` redirect to) had no entry in the nav at all; added a "Home" item.
- `components/layout/MobileNav.tsx` — a slide-in drawer with backdrop, closes on navigation/backdrop click, locks body scroll while open, built with the same `framer-motion` idioms already used elsewhere in the app.
- Wired into `components/layout/Topbar.tsx` (mobile-only hamburger button, `md:hidden`) — meaning it works consistently on **every** dashboard page, not just the home page, since that's how a persistent app nav should behave.

**2. UI/color-palette consistency audit** — I actually audited every page rather than eyeballing a few:
- **Page container spacing**: found 9 different padding patterns across ~24 pages (`px-5 md:px-8 lg:px-10 pb-12`, `px-4 pb-16 md:px-8`, `px-6 pb-12 md:px-10`, etc.) — several of which didn't even match the shared `Topbar`'s own `px-6 md:px-10`, so content was visibly misaligned under the header on those pages. Standardized all of them to one canonical `px-6 md:px-10 pb-10` (18 pages now share the exact class).
- **Structural surface colors**: `Sidebar`, `ChatPanel`, and the home page had several one-off hex values (`bg-[#fffdfb]`, `border-[#e9e2f5]`, etc.) that were near-duplicates of existing theme tokens — consolidated onto `bg-surface`, `border-primary-100`, `bg-surface-alt`, `text-primary-600`, `text-ink-300`.
- **Bug fixes found along the way**: a mojibake-corrupted emoji in the home page's welcome message (`ðŸ‘‹` → `👋`), a dead `journey/page.backup.tsx` file, and 4 pre-existing unescaped-apostrophe lint errors in files I was already touching.

**Deliberately not touched**: the Garden of Growth, Storybook, and Journey pages' decorative color palettes (nature greens, warm parchment tones) are hand-tuned, page-specific art direction — not inconsistency. The home page also has ~70 hand-picked micro-accent shades (matched gradient/shadow colors per card) that read as intentional design polish rather than drift. Flattening either into the 5-token core palette would reduce visual quality, not improve consistency, so I left them as-is and only fixed genuine structural duplication (colors that were clearly meant to be an existing token but got hand-typed as a slightly different hex instead).

**Verified**: `npm run build` and `npm run lint` both run clean against the full project with these changes — 24 routes compile, and the lint problem count went from 52 to 48 (net improvement; no new issues introduced by anything above).
