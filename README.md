<<<<<<< HEAD
# AI Academic Project Mentor — Full Project

Two separate projects, run together in two terminals:

```
academic-mentor-project/
  frontend/    -> Next.js web app -- localhost:3000
  backend/     -> FastAPI + Gemini AI agents -- localhost:8000
```

**Task 1 (Feasibility Analysis Agent) is fully built and now visible in the UI** — on the Projects page, each idea card has an "Analyze Feasibility" button. Click it, and the AI's verdict, confidence score, reasoning, and skill gaps appear right there on the card.

## One-time setup

**Frontend:**
```
cd frontend
npm install
```
Copy `.env.local.example` to `.env.local`, fill in your Supabase URL + anon key.

**Backend:**
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
Copy `.env.example` to `.env`, fill in Supabase service role key + Gemini API key (free at aistudio.google.com/apikey).

**Database:** Supabase -> SQL Editor -> run `frontend/supabase/migration.sql` (or the identical `backend/supabase/migration_step6_agent_feedback.sql`) once.

## Running it (every time)

**Terminal 1:**
```
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2:**
```
cd frontend
npm run dev
```

Open `http://localhost:3000`, log in, go to Projects, click **Analyze Feasibility** on any idea.

## Why this needs CORS (and why it's already handled)

The frontend (`localhost:3000`) and backend (`localhost:8000`) are different origins as far as your browser is concerned — without explicit permission, the browser blocks the frontend's request to the backend entirely. The backend's `FRONTEND_ORIGIN` setting in `.env` handles this already; just make sure it matches whatever URL your frontend actually runs on.

## Quick reference

| | Folder | Command | URL |
|---|---|---|---|
| Frontend | `frontend/` | `npm run dev` | `localhost:3000` |
| Backend | `backend/` | `uvicorn app.main:app --reload` | `localhost:8000` |

Full details in each project's own README.
=======
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
>>>>>>> e89a09e64be8694536878c1398bed834f935bc31
