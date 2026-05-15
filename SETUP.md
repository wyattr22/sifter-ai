# Sifter AI — Local Setup Guide

Screen 200 resumes in under 60 seconds. Swipe to hire on merit, bias-free.

---

## Prerequisites

- **Node.js 18+** — download at [nodejs.org](https://nodejs.org) (click "LTS")
- **Git** — download at [git-scm.com](https://git-scm.com)
- A terminal (Mac: Terminal / Windows: Command Prompt or PowerShell)

---

## Step 1 — Download the app

```bash
git clone https://github.com/wyattr22/sifter-ai.git
cd sifter-ai
npm install
cp .env.local.example .env.local
```

---

## Step 2 — Choose your AI option

Pick the option that fits your company's security requirements.

---

### Option A — Fully Local (recommended for HR/security)

**Resume data never leaves your machine.** All AI processing happens on your own hardware.

Works with any of these tools — pick one:

---

#### Ollama *(easiest, Mac/Windows/Linux)*

1. Download and install from **[ollama.com](https://ollama.com)**
2. Open a terminal and pull the model (one-time, ~5 GB):
   ```bash
   ollama pull llama3.1:8b
   ```
3. In `.env.local`, add:
   ```
   LOCAL_AI_MODEL=llama3.1:8b
   ```
   `LOCAL_AI_BASE_URL` is not needed — Ollama's default port is used automatically.

---

#### LM Studio *(best for non-technical teams — no terminal needed)*

1. Download from **[lmstudio.ai](https://lmstudio.ai)** and install
2. Open LM Studio → search for `llama-3.1-8b-instruct` → click Download
3. Go to **Local Server** tab → click **Start Server**
4. In `.env.local`, add:
   ```
   LOCAL_AI_MODEL=llama-3.1-8b-instruct
   LOCAL_AI_BASE_URL=http://localhost:1234/v1
   ```

---

#### vLLM *(best for companies with a shared GPU server)*

Run once on your server:
```bash
pip install vllm
vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct --port 8000
```
In `.env.local` on each user's machine, add:
```
LOCAL_AI_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
LOCAL_AI_BASE_URL=http://YOUR-SERVER-IP:8000/v1
```
Everyone on the team points to the same server — no model download per machine.

---

### Option B — Free Cloud APIs *(fastest, 5-minute setup)*

Resume text is sent to the AI provider for processing. Names, companies, and schools are **anonymized before sending** (replaced with "Candidate", "[Company]", "[University]"). No data is stored by the provider.

Get a free key from any of these (no credit card required):

| Provider | Speed | Get key |
|----------|-------|---------|
| Cerebras | ⚡⚡⚡ Fastest | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| Google Gemini | ⚡⚡ Fast | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Groq | ⚡ Fast | [console.groq.com](https://console.groq.com) |

In `.env.local`, paste your key(s):
```
CEREBRAS_API_KEY=csk-your-key-here
GROQ_API_KEY=gsk-your-key-here
```
Multiple keys can be active at once — the app load-balances across them for speed.

---

### Option C — Private Cloud *(data stays in your Azure/AWS/GCP tenant)*

If your company already has an Azure OpenAI deployment:

```
LOCAL_AI_MODEL=gpt-4o
LOCAL_AI_BASE_URL=https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT
```

AWS Bedrock and Google Vertex AI are also supported — contact wyatt.rantz@gmail.com for setup help.

---

## Step 3 — Start the app

```bash
npm run dev
```

Open your browser and go to: **http://localhost:3000**

Press `Ctrl+C` in the terminal to stop the app when done.

---

## Adding your own resumes

Sifter works with your internal candidate files:

- **PDF upload** — drag and drop up to ~50 PDFs directly into the app
- **CSV import** — export from your ATS (Greenhouse, Lever, Workday) as CSV; the app auto-detects the resume column
- **Paste** — copy-paste resume text, separated by `---`
- **Search** — pull from our 64,000+ resume database by role (useful for testing)

---

## Privacy & data summary

| | Option A — Local AI | Option B — Cloud API | Option C — Private Cloud |
|---|---|---|---|
| Data leaves machine | Never | Yes (anonymized) | Stays in your cloud |
| Internet required | No (after setup) | Yes | Yes |
| Speed | Moderate | Fast | Fast |
| Cost | Free | Free | Your cloud costs |
| Setup time | 10–20 min | 5 min | Varies |
| Best for | Strict HR/legal requirements | Speed and simplicity | Enterprise with existing cloud |

---

## Troubleshooting

**"command not found: npm"** — Install Node.js from [nodejs.org](https://nodejs.org) (LTS version).

**"Ollama connection refused"** — Ollama isn't running. Open a terminal and run `ollama serve`, then try again.

**LM Studio not working** — Make sure you clicked **Start Server** in the Local Server tab, and that the port shown matches `LOCAL_AI_BASE_URL` in `.env.local`.

**"No resumes found"** — The resume database search requires internet. If on a restricted network, use PDF/CSV upload instead.

**App is slow on Option A** — Ollama/LM Studio uses your CPU by default. On a Mac with Apple Silicon or a PC with an NVIDIA GPU, it runs automatically on the GPU at ~10x speed.

**Port 3000 already in use** — Run `npm run dev -- -p 3001` and open `http://localhost:3001`.

---

## Questions?

Contact: wyatt.rantz@gmail.com
