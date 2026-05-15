# Sifter AI — Resume Screener

Screen 200 resumes in under 60 seconds. Paste a job description, load resumes, and swipe through AI-ranked candidates across 3 blind screening rounds.

**Live demo:** [job-screener.vercel.app](https://job-screener.vercel.app)

---

## What it does

- **AI pre-screening** — ranks every resume by fit score before you see a single card
- **Blind swiping** — names and companies are hidden to reduce bias
- **3 rounds** — Technical → Experience → Overall Fit
- **5-dimension scoring** — Skills, Experience, Scale, Impact, Domain (weights adjustable)
- **CSV export** — finalists with scores, notes, and recruiter summaries
- **Session persistence** — resume where you left off after a browser refresh

---

## Scoring

| Category | What it measures |
|---|---|
| **Skills Match** | Required skills found vs. missing from the resume |
| **Experience** | Years of experience vs. what the role requires |
| **Scale** | Size of systems and companies they've worked at |
| **Impact** | Quality of achievements — vague claims vs. metrics-backed results |
| **Domain** | How relevant their industry background is to this role |

**Fit Score** is a weighted average of all five. Adjust the weights before screening to match your priorities.

| Decision | Score | Meaning |
|---|---|---|
| ADVANCE | ≥ 75 | Schedule the interview |
| HOLD | 50–74 | Phone screen first |
| REJECT | < 50 | Missing requirements |

---

## Running locally

### 1. Clone and install

```bash
git clone https://github.com/wyattr22/sifter-ai.git
cd sifter-ai
npm install
```

### 2. Get an API key

Sifter uses LLMs to score resumes. Pick whichever provider you have access to — **Groq and Cerebras both have free tiers** that cover thousands of resumes per day.

| Provider | Speed | Cost | Get key |
|---|---|---|---|
| **Groq** (recommended) | Very fast | Free tier available | [console.groq.com](https://console.groq.com) |
| **Cerebras** | Very fast | Free tier available | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Google Gemini** | Fast | Free tier available | [aistudio.google.com](https://aistudio.google.com) |
| **Ollama (local)** | Varies | Free, fully private | [ollama.ai](https://ollama.ai) |

You can set multiple keys — Sifter will distribute requests across providers and fall back automatically on rate limits.

### 3. Set environment variables

Create a `.env.local` file in the project root:

```bash
# Add whichever providers you have — at least one is required

GROQ_API_KEY=your_groq_key_here
CEREBRAS_API_KEY=your_cerebras_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here

# Optional: run fully locally with Ollama (zero data leaves your machine)
# First run: ollama pull llama3.1:8b
LOCAL_AI_MODEL=llama3.1:8b
LOCAL_AI_BASE_URL=http://localhost:11434/v1
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

```bash
npm install -g vercel
vercel env add GROQ_API_KEY production
vercel --prod
```

---

## Loading resumes

Three ways to get resumes into Sifter:

1. **HuggingFace search** — search by job title to pull real resumes from public datasets (built-in, no setup needed)
2. **CSV upload** — any CSV with a resume text column (Kaggle datasets work out of the box)
3. **PDF upload** — drag and drop individual PDFs or TXT files

---

## Privacy

- Candidate names and companies are anonymized by the AI before any scoring
- If you run with `LOCAL_AI_MODEL` (Ollama), no resume data leaves your machine
- No data is stored — everything lives in your browser session

---

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Vercel AI SDK v6** — multi-provider with automatic failover
- **Zod** — structured output validation
