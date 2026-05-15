'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

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

// ── Skill extraction ─────────────────────────────────────────────────────────

const KNOWN_TECH = [
  'python','javascript','typescript','java','golang','rust','ruby','scala','kotlin','swift',
  'react','angular','vue','nextjs','nodejs','django','fastapi','flask','rails','spring','laravel',
  'postgres','postgresql','mysql','mongodb','redis','kafka','elasticsearch','dynamodb','cassandra',
  'docker','kubernetes','terraform','ansible','jenkins','linux','bash','git',
  'graphql','grpc','rest','sql','nosql','hadoop','spark','airflow','dbt','flink',
  'pytorch','tensorflow','scikit','pandas','numpy','mlflow',
  'aws','gcp','azure','s3','ec2','lambda','bigquery','snowflake',
];

const NOISE = new Set(['The','Our','Your','This','Must','Have','Will','With','For','And',
  'But','All','Some','More','Many','Each','Also','Very','Well','Just','Over','Team',
  'Company','Role','Work','Lead','Join','Full','Time','New','Can','May','Strong','Good',
  'AI','UI','UX','PM','HR','ID','OK']);

// Signal words that indicate a skill is required vs preferred
const REQUIRED_SIGNALS = /\b(required|must.have|must|essential|need|necessary|expect|qualif|mandator)/i;
const BONUS_SIGNALS    = /\b(prefer|nice.to.have|bonus|plus|ideal|great.if|advantage|optiona|desirabl)/i;

function extractAndRankSkills(jd: string): { required: string[]; bonus: string[] } {
  const jdLow = jd.toLowerCase();
  const skillMap = new Map<string, string>(); // canonical → display form

  // ALL-CAPS acronyms (3+ chars to cut noise)
  for (const m of jd.matchAll(/\b[A-Z]{3,8}\b/g)) {
    if (!NOISE.has(m[0])) skillMap.set(m[0].toLowerCase(), m[0]);
  }
  // PascalCase: PostgreSQL, TypeScript, GraphQL
  for (const m of jd.matchAll(/\b[A-Z][a-z]+[A-Z][a-zA-Z0-9]*\b/g)) {
    if (!NOISE.has(m[0])) skillMap.set(m[0].toLowerCase(), m[0]);
  }
  // Node.js, C++, C#, .NET
  for (const m of jd.matchAll(/\b\w+\.js\b|\bC\+\+\b|\bC#\b|\.NET\b/gi)) {
    skillMap.set(m[0].toLowerCase(), m[0]);
  }
  // Known lowercase tech terms
  for (const t of KNOWN_TECH) {
    if (jdLow.includes(t)) {
      const match = jd.match(new RegExp(`\\b${t}\\b`, 'i'));
      skillMap.set(t, match ? match[0] : t.charAt(0).toUpperCase() + t.slice(1));
    }
  }

  // Score each skill
  const scored: { display: string; score: number; tier: 'required' | 'bonus' }[] = [];
  for (const [canonical, display] of skillMap) {
    if (display.length < 2) continue;

    // Count occurrences
    const freq = (jdLow.match(new RegExp(`\\b${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) ?? []).length;

    // Check first occurrence position (earlier = more important)
    const pos = jdLow.indexOf(canonical);
    const posScore = pos < 0 ? 0 : Math.round((1 - pos / jd.length) * 3);

    // Check context window around each occurrence for signal words
    let requiredHits = 0, bonusHits = 0;
    for (const m of jdLow.matchAll(new RegExp(`\\b${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))) {
      const ctx = jd.slice(Math.max(0, m.index! - 120), m.index! + 120);
      if (REQUIRED_SIGNALS.test(ctx)) requiredHits++;
      if (BONUS_SIGNALS.test(ctx)) bonusHits++;
    }

    const score = freq * 2 + posScore + requiredHits * 3 - bonusHits * 2;
    const tier = bonusHits > requiredHits ? 'bonus' : 'required';
    scored.push({ display, score, tier });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    required: scored.filter(s => s.tier === 'required').slice(0, 12).map(s => s.display),
    bonus:    scored.filter(s => s.tier === 'bonus').slice(0, 6).map(s => s.display),
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoringWeights {
  skills: number; experience: number; scale: number; impact: number; domain: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = { skills: 30, experience: 20, scale: 20, impact: 20, domain: 10 };

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
  requiredSkills: string[];
  bonusSkills: string[];
  weights: ScoringWeights;
}

interface Props {
  onStart: (payload: SetupPayload) => void;
}

const SAMPLE_OPTIONS = [
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
];

// ── Component ────────────────────────────────────────────────────────────────

export function SetupForm({ onStart }: Props) {
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [csvInfo, setCsvInfo] = useState<{ totalRows: number; column: string } | null>(null);
  const [csvRows, setCsvRows] = useState<{ text: string; category: string }[]>([]);
  const [allCategories, setAllCategories] = useState<{ name: string; count: number }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sampleSize, setSampleSize] = useState(200);
  const [randomize, setRandomize] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [bonusSkills, setBonusSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const applyExtractedSkills = useCallback((jdText: string) => {
    const { required, bonus } = extractAndRankSkills(jdText);
    setRequiredSkills(required);
    setBonusSkills(bonus);
  }, []);

  const moveToBonus = (skill: string) => {
    setRequiredSkills(p => p.filter(s => s !== skill));
    setBonusSkills(p => [...p, skill]);
  };
  const moveToRequired = (skill: string) => {
    setBonusSkills(p => p.filter(s => s !== skill));
    setRequiredSkills(p => [...p, skill]);
  };
  const removeSkill = (skill: string) => {
    setRequiredSkills(p => p.filter(s => s !== skill));
    setBonusSkills(p => p.filter(s => s !== skill));
  };
  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || requiredSkills.includes(s) || bonusSkills.includes(s)) return;
    setRequiredSkills(p => [...p, s]);
    setNewSkill('');
  };

  // Re-derive resumes whenever category filter, sample size, or randomize changes
  useEffect(() => {
    if (!csvRows.length) return;
    const filtered = selectedCategories.length > 0
      ? csvRows.filter(r => selectedCategories.includes(r.category))
      : csvRows;
    const texts = filtered.map(r => r.text);
    const effectiveSize = Math.min(sampleSize, texts.length);
    const selected = randomize ? shuffle(texts).slice(0, effectiveSize) : texts.slice(0, effectiveSize);
    setResumes(selected.join('\n---\n'));
  }, [csvRows, selectedCategories, sampleSize, randomize]);

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev => {
      if (prev.length === 0) return allCategories.filter(c => c.name !== name).map(c => c.name);
      if (prev.includes(name)) {
        const next = prev.filter(s => s !== name);
        return next.length === 0 ? [] : next;
      }
      const next = [...prev, name];
      return next.length === allCategories.length ? [] : next;
    });
  };

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

        const parsed = lines.slice(1).map(l => parseCSVLine(l));
        const validRows = parsed.filter(r => r[colIdx]?.length > 50);

        const rows = validRows.map(r => ({
          text: r[colIdx],
          category: catIdx >= 0 ? (r[catIdx] ?? '') : '',
        }));

        // Build sorted category list — filter out CSV parsing artifacts
        if (catIdx >= 0) {
          const counts: Record<string, number> = {};
          rows.forEach(r => { if (r.category) counts[r.category] = (counts[r.category] ?? 0) + 1; });
          const cleanCats = Object.entries(counts)
            .filter(([name, count]) =>
              count >= 3 &&               // must appear multiple times — fragments are always unique
              name.length <= 40 &&        // job titles are short
              /^[\x20-\x7E]+$/.test(name) // ASCII only — no â¢ bullet encoding garbage
            )
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
          setAllCategories(cleanCats);
          // Re-assign category to empty string for any row whose category didn't make the cut
          const validCatNames = new Set(cleanCats.map(c => c.name));
          rows.forEach(r => { if (!validCatNames.has(r.category)) r.category = ''; });
        } else {
          setAllCategories([]);
        }

        setSelectedCategories([]);
        setCsvRows(rows);
        setCsvInfo({ totalRows: rows.length, column: resumeCol });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse CSV');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  }, []);

  const loadDemo = () => {
    setJd(DEMO_JD);
    setResumes(DEMO_RESUMES);
    setUploadedFiles([]);
    setCsvInfo(null);
    setCsvRows([]);
    setAllCategories([]);
    setSelectedCategories([]);
    applyExtractedSkills(DEMO_JD);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || resumeList.length === 0) return;
    onStart({ jobDescription: jd, resumes: resumeList, requiredSkills, bonusSkills, weights });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 flex flex-col">
      {/* Hero */}
      <div className="px-6 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 mb-6">
          <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
            200 Resumes · 60 Seconds · Blind Screening · 3 Rounds
          </span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-white mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">
            Sifter
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
          200 resumes screened in under 60 seconds. Swipe to hire on merit.
        </p>
      </div>

      <div className="flex-1 px-6 pb-12 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Live HuggingFace role search — primary input method */}
          <HuggingFaceFetcher
            onLoad={(fetchedResumes, fetchedJd) => {
              setResumes(fetchedResumes.join('\n---\n'));
              if (fetchedJd && !jd.trim()) {
                setJd(fetchedJd);
                applyExtractedSkills(fetchedJd);
              }
              setCsvInfo(null);
              setCsvRows([]);
              setAllCategories([]);
              setSelectedCategories([]);
              setUploadedFiles([]);
            }}
          />

          {/* Job description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Job Description
              {jd && <span className="ml-2 text-indigo-400 normal-case font-normal">— auto-filled from dataset</span>}
            </label>
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              onPaste={e => {
                const el = e.currentTarget;
                setTimeout(() => {
                  if (el.value.trim().length > 50) applyExtractedSkills(el.value);
                }, 0);
              }}
              placeholder="Auto-filled when you search a role, or paste your own..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-32 resize-y outline-none focus:border-indigo-500/50 transition"
              required
            />
          </div>

          {/* Skill requirements tagger */}
          {jd.trim().length > 30 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Skill Requirements</p>
                  <p className="text-zinc-600 text-[11px] mt-0.5">Click any skill to move it between Required and Nice-to-have</p>
                </div>
                <button
                  type="button"
                  onClick={() => applyExtractedSkills(jd)}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                >
                  Re-extract
                </button>
              </div>

              {/* Required skills */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5">Required</p>
                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {requiredSkills.length === 0 && (
                    <span className="text-zinc-600 text-xs italic">No required skills set — add some below</span>
                  )}
                  {requiredSkills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      <button type="button" onClick={() => moveToBonus(s)} title="Move to nice-to-have">{s}</button>
                      <button type="button" onClick={() => removeSkill(s)} className="text-emerald-500/60 hover:text-emerald-300 ml-0.5 leading-none">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Bonus skills */}
              {bonusSkills.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Nice-to-have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bonusSkills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                        <button type="button" onClick={() => moveToRequired(s)} title="Move to required">{s}</button>
                        <button type="button" onClick={() => removeSkill(s)} className="text-zinc-600 hover:text-zinc-400 ml-0.5 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add skill */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  placeholder="Add a skill..."
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 px-3 py-1.5 text-xs outline-none focus:border-indigo-500/50 transition"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  disabled={!newSkill.trim()}
                  className="rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 transition disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Resume count indicator */}
          {resumeList.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
              <span className="text-emerald-400 text-lg">✓</span>
              <div>
                <p className="text-emerald-300 text-sm font-bold">{resumeList.length} resumes loaded</p>
                <p className="text-emerald-600 text-xs">All will be screened and ranked before swiping begins</p>
              </div>
            </div>
          )}

          {/* Collapse: other upload methods */}
          <details className="group">
            <summary className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-300 transition select-none list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Other ways to add resumes (PDF upload, CSV import, paste)
            </summary>
            <div className="mt-4 space-y-4">
              {/* Upload zone */}
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/3 hover:bg-white/8 p-4 transition cursor-pointer"
                    >
                      <span className="text-2xl">📄</span>
                      <span className="text-white/70 text-xs font-semibold">Upload PDFs / TXTs</span>
                      <span className="text-zinc-600 text-[10px]">Drop or click · multiple OK</span>
                    </button>
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
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/8 p-4 space-y-4">
                  <div>
                    <p className="text-violet-300 text-sm font-bold">{csvInfo.totalRows.toLocaleString()} resumes detected</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Column: <code className="text-zinc-400">{csvInfo.column}</code></p>
                  </div>

                  {/* Category filter */}
                  {allCategories.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Filter by job category</p>
                        {selectedCategories.length > 0 && (
                          <button type="button" onClick={() => setSelectedCategories([])}
                            className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold transition">
                            Show all
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allCategories.map(({ name, count }) => {
                          const active = selectedCategories.length === 0 || selectedCategories.includes(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleCategory(name)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                active
                                  ? 'bg-violet-500/30 border border-violet-400/50 text-violet-200'
                                  : 'bg-white/5 border border-white/10 text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              {name} <span className="opacity-60">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sample size + randomize */}
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {SAMPLE_OPTIONS.filter(o => o.value <= csvInfo.totalRows).map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setSampleSize(o.value)}
                          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                            sampleSize === o.value
                              ? 'bg-violet-500 text-white'
                              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} className="rounded" />
                      <span className="text-zinc-400 text-xs">Randomize selection (recommended)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Uploaded PDF list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
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
              <div>
                <p className="text-zinc-600 text-xs mb-2">Or paste resume text manually (separate with ---)</p>
                <textarea
                  value={resumes}
                  onChange={e => setResumes(e.target.value)}
                  placeholder={'Paste resumes separated by ---'}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-28 resize-y outline-none focus:border-indigo-500/50 transition"
                />
              </div>

              <button
                type="button"
                onClick={loadDemo}
                className="text-zinc-500 hover:text-zinc-300 transition text-xs"
              >
                Load demo data (5 sample candidates)
              </button>
            </div>
          </details>

          {/* Scoring weights */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setWeightsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Scoring Weights</p>
                <p className="text-zinc-600 text-[11px] mt-0.5">
                  Skills {weights.skills}% · Exp {weights.experience}% · Scale {weights.scale}% · Impact {weights.impact}% · Domain {weights.domain}%
                </p>
              </div>
              <span className="text-zinc-500 text-xs">{weightsOpen ? '▲' : '▼'}</span>
            </button>
            {weightsOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Skills Match</span>
                  <input type="range" min={0} max={100} step={5} value={weights.skills}
                    onChange={e => setWeights(prev => ({ ...prev, skills: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-white text-xs font-bold tabular-nums w-8 text-right">{weights.skills}%</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${weights.skills}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Experience</span>
                  <input type="range" min={0} max={100} step={5} value={weights.experience}
                    onChange={e => setWeights(prev => ({ ...prev, experience: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-white text-xs font-bold tabular-nums w-8 text-right">{weights.experience}%</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${weights.experience}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Scale</span>
                  <input type="range" min={0} max={100} step={5} value={weights.scale}
                    onChange={e => setWeights(prev => ({ ...prev, scale: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-white text-xs font-bold tabular-nums w-8 text-right">{weights.scale}%</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${weights.scale}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Impact</span>
                  <input type="range" min={0} max={100} step={5} value={weights.impact}
                    onChange={e => setWeights(prev => ({ ...prev, impact: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-white text-xs font-bold tabular-nums w-8 text-right">{weights.impact}%</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${weights.impact}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Domain</span>
                  <input type="range" min={0} max={100} step={5} value={weights.domain}
                    onChange={e => setWeights(prev => ({ ...prev, domain: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-white text-xs font-bold tabular-nums w-8 text-right">{weights.domain}%</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${weights.domain}%` }} />
                  </div>
                </div>
                {(() => {
                  const total = weights.skills + weights.experience + weights.scale + weights.impact + weights.domain;
                  return (
                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 transition">
                        Reset to defaults
                      </button>
                      <span className={`text-xs font-bold tabular-nums ${total === 100 ? 'text-emerald-400' : total > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                        Total: {total}%{total !== 100 ? (total > 100 ? ' — reduce by ' + (total - 100) + '%' : ' — add ' + (100 - total) + '%') : ' ✓'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
          )}

          <button
            type="submit"
            disabled={resumeList.length === 0 || !jd.trim() || Object.values(weights).reduce((s, v) => s + v, 0) !== 100}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-4 text-sm font-bold text-white hover:from-indigo-400 hover:to-violet-400 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {resumeList.length > 0
              ? `Start Sifting → Screen & rank ${resumeList.length} candidate${resumeList.length !== 1 ? 's' : ''}`
              : 'Start Sifting →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── HuggingFace role search ──────────────────────────────────────────────────

interface HFCategory { role: string; count: number; }

const ROLE_CHIP_COLORS = [
  'border-blue-500/30 bg-blue-500/8 text-blue-300 hover:bg-blue-500/20',
  'border-violet-500/30 bg-violet-500/8 text-violet-300 hover:bg-violet-500/20',
  'border-pink-500/30 bg-pink-500/8 text-pink-300 hover:bg-pink-500/20',
  'border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/20',
  'border-emerald-500/30 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/20',
  'border-cyan-500/30 bg-cyan-500/8 text-cyan-300 hover:bg-cyan-500/20',
];

const COMMON_ROLES = [
  'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer', 'Principal Software Engineer',
  'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Full Stack Developer',
  'Data Engineer', 'Data Scientist', 'Data Analyst', 'Business Intelligence Analyst', 'Analytics Engineer',
  'Machine Learning Engineer', 'AI Engineer', 'MLOps Engineer', 'Research Scientist',
  'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer', 'Cloud Engineer', 'Infrastructure Engineer',
  'iOS Engineer', 'Android Engineer', 'Mobile Engineer', 'React Native Developer',
  'Embedded Systems Engineer', 'Firmware Engineer', 'Systems Engineer',
  'Security Engineer', 'Cybersecurity Analyst', 'Penetration Tester',
  'QA Engineer', 'Test Engineer', 'SDET',
  'Product Manager', 'Senior Product Manager', 'Principal Product Manager', 'Group Product Manager',
  'Product Designer', 'UX Designer', 'UI Designer', 'UX Researcher',
  'Engineering Manager', 'Director of Engineering', 'VP of Engineering', 'CTO',
  'Technical Program Manager', 'Program Manager', 'Project Manager', 'Scrum Master',
  'Solutions Architect', 'Cloud Architect', 'Enterprise Architect',
  'Financial Analyst', 'Investment Analyst', 'Quantitative Analyst',
  'Account Manager', 'Account Executive', 'Sales Engineer', 'Solutions Engineer',
  'Marketing Manager', 'Growth Manager', 'Content Strategist', 'SEO Specialist',
  'Operations Manager', 'Business Analyst', 'Management Consultant',
  'Recruiting Coordinator', 'Technical Recruiter', 'HR Business Partner',
  'Database Administrator', 'Network Engineer', 'Network Administrator',
  'Blockchain Developer', 'Smart Contract Engineer', 'Web3 Engineer',
  'Game Developer', 'Game Designer', 'Unity Developer', 'Unreal Engine Developer',
];

function HuggingFaceFetcher({ onLoad }: { onLoad: (resumes: string[], jd: string | null) => void }) {
  const [categories, setCategories] = useState<HFCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState('');
  const [count, setCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fetched: number; roleTotal: number | null; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Load categories on mount
  useEffect(() => {
    fetch('/api/fetch-dataset?count=100')
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories ?? []);
        setTotal(d.total ?? null);
        setLoadingCats(false);
      })
      .catch(() => setLoadingCats(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = useMemo(() => {
    const q = customRole.trim().toLowerCase();
    if (!q) return [];
    const fromDB = categories.map(c => c.role);
    const all = Array.from(new Set([...fromDB, ...COMMON_ROLES]));
    return all.filter(r => r.toLowerCase().includes(q)).slice(0, 8);
  }, [customRole, categories]);

  const selectSuggestion = (role: string) => {
    setCustomRole(role);
    setSelectedRole(null);
    setResult(null);
    setShowSuggestions(false);
    setHighlightedIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && highlightedIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[highlightedIdx]); }
    else if (e.key === 'Escape') { setShowSuggestions(false); setHighlightedIdx(-1); }
  };

  const activeRole = customRole.trim() || selectedRole;
  const COUNTS = [10, 25, 50, 100, 200];

  const handleFetch = async () => {
    if (!activeRole) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/fetch-dataset?count=${count}&role=${encodeURIComponent(activeRole)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
      if (!data.resumes?.length) throw new Error(`No resumes found for "${activeRole}" — try a different role`);
      setResult({ fetched: data.fetched, roleTotal: data.roleTotal, role: activeRole });
      onLoad(data.resumes, data.jobDescription);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const FALLBACK_CHIPS = [
    'Software Engineer', 'Data Scientist', 'Data Engineer', 'Product Manager',
    'Frontend Engineer', 'Backend Engineer', 'Machine Learning Engineer', 'DevOps Engineer',
    'Data Analyst', 'Full Stack Engineer', 'iOS Engineer', 'Android Engineer',
  ];
  const displayChips: { role: string; count: number }[] = categories.length > 0
    ? categories
    : FALLBACK_CHIPS.map(r => ({ role: r, count: 0 }));

  return (
    <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/8 to-violet-500/8 p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🤗</span>
        <div>
          <p className="text-white font-bold text-sm">Search Real Resumes by Role</p>
          <p className="text-zinc-400 text-xs mt-0.5">
            {total
              ? <><span className="text-pink-300 font-bold">{total.toLocaleString()} real resumes</span> · 5 datasets · pick a role to search</>
              : 'Connecting to databases...'}
          </p>
        </div>
      </div>

      {/* Role chips */}
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Select a role</p>
        {loadingCats ? (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 rounded-full bg-white/5 animate-pulse" style={{ width: `${60 + i * 15}px` }} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayChips.map((c, i) => {
              const isSelected = selectedRole === c.role && !customRole;
              const colorClass = ROLE_CHIP_COLORS[i % ROLE_CHIP_COLORS.length];
              return (
                <button
                  key={c.role}
                  type="button"
                  onClick={() => { setSelectedRole(c.role); setCustomRole(''); setResult(null); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-pink-500 border-pink-500 text-white scale-105 shadow-lg shadow-pink-500/20'
                      : colorClass
                  }`}
                >
                  {c.role}
                  {c.count > 0 && <span className="ml-1.5 opacity-50 text-[10px]">{c.count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom role input with autocomplete */}
      <div className="mb-4 relative" ref={autocompleteRef}>
        <input
          type="text"
          value={customRole}
          onChange={e => {
            setCustomRole(e.target.value);
            setSelectedRole(null);
            setResult(null);
            setShowSuggestions(true);
            setHighlightedIdx(-1);
          }}
          onFocus={() => { if (customRole.trim()) setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Or search a custom role (e.g. Machine Learning Engineer)..."
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 px-4 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-white/10 bg-zinc-900 shadow-xl overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                onMouseEnter={() => setHighlightedIdx(i)}
                className={`w-full text-left px-4 py-2.5 text-sm transition ${
                  highlightedIdx === i
                    ? 'bg-pink-500/20 text-pink-200'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Count picker + fetch button */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 shrink-0 flex-wrap">
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
              {n === 200 ? '200 ⚡' : n}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFetch}
          disabled={loading || !activeRole}
          className="flex-1 min-w-0 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-4 py-2 text-xs font-bold text-white hover:from-pink-400 hover:to-violet-400 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Searching...
            </>
          ) : activeRole ? (
            <>⚡ Search {count} &ldquo;{activeRole}&rdquo; resumes</>
          ) : (
            <>Select a role above</>
          )}
        </button>
      </div>

      {/* Result confirmation */}
      {result && !loading && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
          <span className="text-emerald-400 text-sm mt-0.5">✓</span>
          <div>
            <p className="text-emerald-300 text-xs font-semibold">
              {result.fetched} &ldquo;{result.role}&rdquo; resumes loaded
              {result.roleTotal ? ` · ${result.roleTotal.toLocaleString()} total in database` : ''}
            </p>
            <p className="text-emerald-600 text-[10px] mt-0.5">Job description auto-filled from dataset · edit it below if needed</p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
      )}
    </div>
  );
}
