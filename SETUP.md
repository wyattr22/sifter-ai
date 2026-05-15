# Sifter AI — Local Setup Guide

Screen 200 resumes in under 60 seconds. Runs entirely on your own computer — no data sent to third parties (with the Ollama option below).

---

## Prerequisites

- **Node.js 18+** — download at [nodejs.org](https://nodejs.org) (click "LTS")
- **Git** — download at [git-scm.com](https://git-scm.com)
- A terminal (Mac: Terminal app / Windows: Command Prompt or PowerShell)

---

## Step 1 — Download the app

Open a terminal and run:

```bash
git clone https://github.com/wyattr22/job-screener.git
cd job-screener
npm install
```

---

## Step 2 — Choose your AI option

Pick **one** of the two options below. Option A keeps all resume data on your machine.

---

### Option A — Fully Local (recommended for HR/security)

**Resume data never leaves your computer.** Processing happens on your CPU/GPU.

1. Download Ollama from **[ollama.com](https://ollama.com)** and install it (works on Mac, Windows, Linux)

2. Open a terminal and download the AI model (one-time, ~5 GB):
   ```bash
   ollama pull llama3.1:8b
   ```

3. Create your config file:
   ```bash
   cp .env.local.example .env.local
   ```

4. Open `.env.local` in any text editor and uncomment this line (remove the `#`):
   ```
   OLLAMA_MODEL=llama3.1:8b
   ```

**Speed:** ~30–120 seconds per 40 candidates (depends on your CPU/GPU)

---

### Option B — Free Cloud APIs (faster, 5-minute setup)

Resume text is sent to the AI provider's API for processing. Names, companies, and schools are **anonymized before sending** (replaced with "Candidate", "[Company]", "[University]"). No data is stored by the provider.

1. Get a free API key from any of these (takes ~2 minutes each, no credit card):
   - **Cerebras** (fastest): [cloud.cerebras.ai](https://cloud.cerebras.ai)
   - **Groq**: [console.groq.com](https://console.groq.com)
   - **Google Gemini**: [aistudio.google.com](https://aistudio.google.com/app/apikey)

2. Create your config file:
   ```bash
   cp .env.local.example .env.local
   ```

3. Open `.env.local` and paste your key(s):
   ```
   CEREBRAS_API_KEY=csk-your-key-here
   GROQ_API_KEY=gsk-your-key-here
   ```
   You can add multiple keys — the app uses them all in parallel for speed.

**Speed:** ~5–15 seconds per 40 candidates

---

## Step 3 — Start the app

```bash
npm run dev
```

Open your browser and go to: **http://localhost:3000**

The app is running. You can now:
- Search for resumes by role from our 64,000+ resume database
- Upload your own resumes as PDF files
- Import a CSV of resumes
- Paste resume text directly

Press `Ctrl+C` in the terminal to stop the app when done.

---

## Adding your own resumes

Sifter works with your internal candidate files:

- **PDF upload** — drag and drop up to ~50 PDFs directly into the app
- **CSV import** — export from your ATS (Greenhouse, Lever, Workday) as CSV; the app auto-detects the resume column
- **Paste** — copy-paste resume text, separated by `---`

---

## Data & Privacy summary

| | Option A (Ollama) | Option B (Cloud API) |
|---|---|---|
| Resume data leaves machine | Never | Yes (anonymized) |
| Internet required | No (after setup) | Yes |
| Processing speed | Moderate | Fast |
| Cost | Free | Free |
| Setup time | ~15 min | ~5 min |

---

## Troubleshooting

**"command not found: npm"** — Node.js isn't installed. Go to [nodejs.org](https://nodejs.org) and install the LTS version.

**"Ollama connection refused"** — Make sure Ollama is running. Open a new terminal and run `ollama serve`, then try again.

**"No resumes found"** — The resume database search requires internet access. If you're on a restricted network, use PDF/CSV upload instead.

**App is slow on Option A** — Ollama uses your CPU by default. If you have an NVIDIA or Apple Silicon GPU, Ollama will use it automatically for ~10x speedup.

**Port 3000 is already in use** — Run `npm run dev -- -p 3001` and open http://localhost:3001 instead.

---

## Questions?

Contact: wrantz@calpoly.edu
