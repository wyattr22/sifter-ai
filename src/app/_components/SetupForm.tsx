'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += c;
  }
  result.push(current.trim());
  return result;
}

function detectResumeColumn(headers: string[]): string | null {
  const patterns = ['resume_str', 'resume', 'cv', 'text', 'content', 'description', 'body'];
  for (const p of patterns) {
    const h = headers.find(h => h.toLowerCase().replace(/[^a-z]/g, '').includes(p.replace(/[^a-z]/g, '')));
    if (h) return h;
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Demo data ────────────────────────────────────────────────────────────────

const DEMO_JD = `Senior Backend Engineer — Python/Django

Requirements:
- 5+ years Python, 3+ years Django or FastAPI in production
- PostgreSQL (schema design, query optimization, migrations)
- REST API design, high-traffic systems (>100k req/day)
- AWS (EC2, RDS, S3)

Nice to have: Redis, Celery, Docker, data pipelines`;

const DEMO_RESUMES = `8 years software engineering. Python expert (6 yrs), Django 4 yrs, FastAPI 2 yrs. Built REST APIs handling 500k req/day at a Series B startup. PostgreSQL DBA-level experience. AWS certified. Redis, Celery, Docker. Led team of 4.
---
4 years Python/Flask, MySQL, Docker. REST APIs at 50k req/day. No AWS or Django. B.S. Computer Science. Fast learner.
---
10 years total. Java/Spring Boot 8 yrs, Python scripting 2 yrs. Strong systems design. No Django, PostgreSQL, or AWS.
---
6 years Python, 3 years Django REST Framework, PostgreSQL daily. Analytics pipeline 200k events/day on AWS Lambda + RDS. Docker, Redis.
---
2 years. Python bootcamp graduate. 3 Django tutorial projects. No production experience. MySQL. Eager learner.`;

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
}

interface Props {
  onStart: (payload: SetupPayload) => void;
}

const SAMPLE_OPTIONS = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
];

// ── Component ────────────────────────────────────────────────────────────────

export function SetupForm({ onStart }: Props) {
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [csvInfo, setCsvInfo] = useState<{ totalRows: number; column: string; categories?: string } | null>(null);
  const [sampleSize, setSampleSize] = useState(50);
  const [randomize, setRandomize] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const resumeList = resumes.split('---').map(r => r.trim()).filter(Boolean);

  // ── PDF upload ───────────────────────────────────────────────────────────

  const parseFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.txt'));
    if (!files.length) return;
    setIsParsing(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const res = await fetch('/api/parse-resume', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const good = data.files.filter((f: { ok: boolean }) => f.ok);
      setUploadedFiles(prev => [...prev, ...data.files]);
      if (good.length) {
        setResumes(prev => {
          const existing = prev.trim();
          const newTexts = good.map((f: { text: string }) => f.text).join('\n---\n');
          return existing ? `${existing}\n---\n${newTexts}` : newTexts;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse files');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const pdfs = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.txt'));
    if (pdfs.length) { parseFiles(pdfs); return; }
    // Also accept CSV drops
    const csvs = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (csvs.length) handleCSVFile(csvs[0]);
  };

  // ── CSV import ───────────────────────────────────────────────────────────

  const handleCSVFile = useCallback((file: File) => {
    setIsParsing(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV appears empty');

        const headers = parseCSVLine(lines[0]);
        const resumeCol = detectResumeColumn(headers);
        if (!resumeCol) throw new Error(`No resume column detected. Headers found: ${headers.join(', ')}`);

        const colIdx = headers.indexOf(resumeCol);
        const catIdx = headers.findIndex(h => h.toLowerCase().includes('categor'));

        const rows = lines.slice(1).map(l => parseCSVLine(l));
        const validRows = rows.filter(r => r[colIdx]?.length > 50);

        // Category breakdown
        let categories: string | undefined;
        if (catIdx >= 0) {
          const counts: Record<string, number> = {};
          validRows.forEach(r => { const c = r[catIdx]; if (c) counts[c] = (counts[c] ?? 0) + 1; });
          categories = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, v]) => `${k} (${v})`)
            .join(', ');
        }

        setCsvInfo({ totalRows: validRows.length, column: resumeCol, categories });

        // Store all rows and apply sampling on submit
        const allTexts = validRows.map(r => r[colIdx]);
        const effectiveSize = Math.min(sampleSize, allTexts.length);
        const selected = randomize ? shuffle(allTexts).slice(0, effectiveSize) : allTexts.slice(0, effectiveSize);

        setResumes(selected.join('\n---\n'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse CSV');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  }, [sampleSize, randomize]);

  const loadDemo = () => {
    setJd(DEMO_JD);
    setResumes(DEMO_RESUMES);
    setUploadedFiles([]);
    setCsvInfo(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || resumeList.length === 0) return;
    onStart({ jobDescription: jd, resumes: resumeList });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 flex flex-col">
      {/* Hero */}
      <div className="px-6 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 mb-6">
          <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
            Blind Screening · 3 Elimination Rounds · CSV Import
          </span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-white mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">
            Sift
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
          Import thousands of real resumes. Swipe through candidates blind. Hire on merit.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {['Kaggle CSV import', 'PDF upload', 'Up to 2,484 real resumes', 'Bias-blind AI scoring'].map(s => (
            <span key={s} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">{s}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pb-12 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Job description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Job Description
            </label>
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder="Paste the job description here..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-36 resize-y outline-none focus:border-indigo-500/50 transition"
              required
            />
          </div>

          {/* Resume sources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Resumes
                {resumeList.length > 0 && (
                  <span className="ml-2 text-indigo-400 normal-case font-normal">
                    — {resumeList.length} loaded
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={loadDemo}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                Load demo (5 candidates)
              </button>
            </div>

            {/* Upload zone — handles both PDF and CSV drops */}
            <div
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`rounded-2xl border-2 border-dashed p-6 transition-all ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                  <p className="text-zinc-400 text-sm">Parsing files...</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* PDF upload */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/3 hover:bg-white/8 p-4 transition cursor-pointer"
                  >
                    <span className="text-2xl">📄</span>
                    <span className="text-white/70 text-xs font-semibold">Upload PDFs / TXTs</span>
                    <span className="text-zinc-600 text-[10px]">Drop or click · multiple OK</span>
                  </button>

                  {/* CSV import */}
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 p-4 transition cursor-pointer"
                  >
                    <span className="text-2xl">📊</span>
                    <span className="text-violet-300 text-xs font-semibold">Import CSV Dataset</span>
                    <span className="text-zinc-600 text-[10px]">Kaggle · HuggingFace · Any CSV</span>
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt" className="hidden"
                onChange={e => e.target.files && parseFiles(e.target.files)} />
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => e.target.files?.[0] && handleCSVFile(e.target.files[0])} />
            </div>

            {/* CSV info panel */}
            {csvInfo && (
              <div className="mt-3 rounded-2xl border border-violet-500/30 bg-violet-500/8 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-violet-300 text-sm font-bold">{csvInfo.totalRows.toLocaleString()} resumes detected</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Column: <code className="text-zinc-400">{csvInfo.column}</code></p>
                    {csvInfo.categories && (
                      <p className="text-zinc-600 text-xs mt-1">Top categories: {csvInfo.categories}</p>
                    )}
                  </div>
                </div>

                {/* Sample size picker */}
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Process how many?</p>
                    <div className="flex gap-2 flex-wrap">
                      {SAMPLE_OPTIONS.filter(o => o.value <= csvInfo.totalRows).map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            setSampleSize(o.value);
                            // Re-parse with new sample size
                            if (csvInputRef.current?.files?.[0]) handleCSVFile(csvInputRef.current.files[0]);
                          }}
                          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                            sampleSize === o.value
                              ? 'bg-violet-500 text-white'
                              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                      {csvInfo.totalRows > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSampleSize(csvInfo.totalRows);
                            if (csvInputRef.current?.files?.[0]) handleCSVFile(csvInputRef.current.files[0]);
                          }}
                          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                            sampleSize === csvInfo.totalRows
                              ? 'bg-violet-500 text-white'
                              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                          }`}
                        >
                          All {csvInfo.totalRows.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={randomize}
                      onChange={e => setRandomize(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-zinc-400 text-xs">Randomize selection (recommended)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Uploaded PDF list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map(f => (
                  <div key={f.name} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                    f.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                         : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                  }`}>
                    <span>{f.ok ? '✓' : '✗'} {f.name} {!f.ok && <span className="opacity-60">{f.error}</span>}</span>
                    <button type="button" onClick={() => setUploadedFiles(p => p.filter(x => x.name !== f.name))}
                      className="text-white/30 hover:text-white/60 ml-2">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Paste fallback */}
            <details className="mt-3">
              <summary className="text-zinc-600 text-xs cursor-pointer hover:text-zinc-400 transition select-none">
                Or paste resume text manually
              </summary>
              <textarea
                value={resumes}
                onChange={e => setResumes(e.target.value)}
                placeholder={'Paste resumes separated by ---'}
                className="mt-2 w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-32 resize-y outline-none focus:border-indigo-500/50 transition"
              />
            </details>
          </div>

          {/* Live HuggingFace fetch */}
          <HuggingFaceFetcher
            onLoad={(resumes, jd) => {
              setResumes(resumes.join('\n---\n'));
              if (jd) setJd(jd);
              setCsvInfo(null);
              setUploadedFiles([]);
            }}
          />

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
          )}

          <button
            type="submit"
            disabled={resumeList.length === 0 || !jd.trim()}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-4 text-sm font-bold text-white hover:from-indigo-400 hover:to-violet-400 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {resumeList.length > 0
              ? `Start Sifting → Process ${resumeList.length} candidate${resumeList.length !== 1 ? 's' : ''}`
              : 'Start Sifting →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── HuggingFace live fetcher ─────────────────────────────────────────────────

interface HFCategory { role: string; count: number; }

function HuggingFaceFetcher({ onLoad }: { onLoad: (resumes: string[], jd: string | null) => void }) {
  const [count, setCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ total: number; fetched: number; categories: HFCategory[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch dataset metadata on mount
  useEffect(() => {
    fetch('/api/fetch-dataset?count=1')
      .then(r => r.json())
      .then(d => { if (d.total) setInfo({ total: d.total, fetched: 0, categories: d.categories ?? [] }); })
      .catch(() => {});
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fetch-dataset?count=${count}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
      setInfo({ total: data.total, fetched: data.fetched, categories: data.categories ?? [] });
      onLoad(data.resumes, data.jobDescription);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const COUNTS = [10, 25, 50, 100];

  return (
    <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/8 to-violet-500/8 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🤗</span>
        <div>
          <p className="text-white font-bold text-sm">Live Resume Database</p>
          <p className="text-zinc-400 text-xs mt-0.5">
            {info?.total
              ? <><span className="text-pink-300 font-bold">{info.total.toLocaleString()} real resumes</span> available · no download needed</>
              : 'Connecting to HuggingFace...'}
          </p>
        </div>
      </div>

      {info?.categories && info.categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {info.categories.map(c => (
            <span key={c.role} className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-zinc-400">
              {c.role}
            </span>
          ))}
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-zinc-500">
            + more roles
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {COUNTS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                count === n
                  ? 'bg-pink-500 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-4 py-2 text-xs font-bold text-white hover:from-pink-400 hover:to-violet-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Fetching {count} resumes...
            </>
          ) : (
            <>⚡ Fetch {count} Random Resumes</>
          )}
        </button>
      </div>

      {info?.fetched ? (
        <p className="mt-2 text-xs text-pink-300/70">
          ✓ {info.fetched} resumes loaded · random sample from {info.total.toLocaleString()} · job description pre-filled
        </p>
      ) : null}

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
