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

### 2. Create `.env.local` with your API key(s)

Sifter supports every major provider. Set whichever keys you already have — **at least one is required**. When multiple are configured, Sifter distributes load across them and fails over automatically on rate limits.

```bash
# ── Free tier providers (thousands of resumes/day at no cost) ────────────────
GROQ_API_KEY=                        # console.groq.com
CEREBRAS_API_KEY=                    # cloud.cerebras.ai
GOOGLE_GENERATIVE_AI_API_KEY=        # aistudio.google.com

# ── Enterprise providers ─────────────────────────────────────────────────────
ANTHROPIC_API_KEY=                   # console.anthropic.com
ANTHROPIC_MODEL=claude-haiku-4-5-20251001   # or claude-sonnet-4-6, claude-opus-4-7

OPENAI_API_KEY=                      # platform.openai.com
OPENAI_MODEL=gpt-4o-mini             # or gpt-4o, gpt-4-turbo, etc.

# ── Azure OpenAI ─────────────────────────────────────────────────────────────
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini  # your deployment name

# ── Self-hosted / on-premise (Ollama, vLLM, LM Studio, any OpenAI-compatible) 
LOCAL_AI_MODEL=llama3.1:8b           # model name as your server expects
LOCAL_AI_BASE_URL=http://localhost:11434/v1   # default is Ollama
LOCAL_AI_API_KEY=                    # leave blank for Ollama; set for vLLM/LM Studio
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Provider quick-reference

| Provider | Env var(s) | Notes |
|---|---|---|
| **Groq** | `GROQ_API_KEY` | Free tier · very fast · recommended for getting started |
| **Cerebras** | `CEREBRAS_API_KEY` | Free tier · very fast |
| **Google Gemini** | `GOOGLE_GENERATIVE_AI_API_KEY` | Free tier |
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` + optional `ANTHROPIC_MODEL` | Default: `claude-haiku-4-5-20251001` |
| **OpenAI** | `OPENAI_API_KEY` + optional `OPENAI_MODEL` | Default: `gpt-4o-mini` |
| **Azure OpenAI** | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_DEPLOYMENT` | Uses your existing Azure subscription |
| **Ollama (local)** | `LOCAL_AI_MODEL` | Zero data leaves your machine |
| **vLLM / LM Studio** | `LOCAL_AI_MODEL` + `LOCAL_AI_BASE_URL` + optional `LOCAL_AI_API_KEY` | Any OpenAI-compatible server |

> **Multiple providers:** Set as many keys as you have. Sifter picks a random provider to start and falls through to the next on any rate limit error, maximizing throughput when screening large batches.

---

## Deploying to Vercel

```bash
npm install -g vercel

# Add your key(s) — repeat for each one you want to use
vercel env add GROQ_API_KEY production
vercel env add ANTHROPIC_API_KEY production
# etc.

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

- Candidate names and companies are anonymized by the AI before scoring
- With `LOCAL_AI_MODEL` (Ollama, vLLM, etc.) no resume data ever leaves your network
- No data is stored server-side — everything lives in the browser session

---

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Vercel AI SDK v6** — unified interface across all providers, automatic failover
- **Zod** — structured output validation
