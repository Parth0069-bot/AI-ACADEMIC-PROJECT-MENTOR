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
