'use client';

import { useState, useRef, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';

const DEMO_JD = `Senior Backend Engineer — Python/Django

Requirements:
- 5+ years Python, 3+ years Django or FastAPI in production
- PostgreSQL (schema design, query optimization, migrations)
- REST API design, high-traffic systems (>100k req/day)
- AWS (EC2, RDS, S3)

Nice to have: Redis, Celery, Docker, data pipelines`;

const DEMO_RESUMES = `8 years software engineering. Python expert (6 yrs), Django 4 yrs, FastAPI 2 yrs. Built REST APIs handling 500k req/day at a Series B startup. PostgreSQL DBA-level experience including schema design. AWS certified. Redis, Celery, Docker. Led a team of 4 engineers. Open source contributor to Django ORM.
---
4 years Python/Flask, MySQL, Docker. Built REST APIs serving 50k req/day. No AWS or Django experience. B.S. Computer Science. Good communicator, fast learner. Prefers backend work.
---
10 years total experience, 2 years Python (mostly scripting). Background in Java/Spring Boot for 8 years. Managed teams of 10+. Strong systems design. No Django, no PostgreSQL, no AWS. Interested in transitioning to Python-first stacks.
---
6 years Python, 3 years Django REST Framework, PostgreSQL daily. Built analytics pipeline handling 200k events/day on AWS Lambda + RDS. Docker, some Redis. Solo contributor but reads architecture well.
---
2 years experience. Python bootcamp graduate, built 3 Django tutorial projects. No production experience. MySQL. Eager, quick learner. Would be a junior hire at best.`;

interface UploadedFile {
  name: string;
  text: string;
  ok: boolean;
  error?: string;
}

interface Props {
  onStart: (candidates: CandidateProfile[]) => void;
}

export function SetupForm({ onStart }: Props) {
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge uploaded files into the resumes textarea
  const mergeFilesIntoText = useCallback((files: UploadedFile[]) => {
    const goodFiles = files.filter(f => f.ok);
    if (goodFiles.length === 0) return;
    setResumes(prev => {
      const existing = prev.trim();
      const newTexts = goodFiles.map(f => f.text).join('\n---\n');
      return existing ? `${existing}\n---\n${newTexts}` : newTexts;
    });
  }, []);

  const parseFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      f => f.name.endsWith('.pdf') || f.name.endsWith('.txt')
    );
    if (files.length === 0) return;

    setIsParsing(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));

      const res = await fetch('/api/parse-resume', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Parse failed');

      const parsed: UploadedFile[] = data.files;
      setUploadedFiles(prev => {
        const next = [...prev, ...parsed];
        mergeFilesIntoText(parsed);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse files');
    } finally {
      setIsParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    parseFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const removeFile = (name: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== name));
  };

  const resumeList = resumes.split('---').map(r => r.trim()).filter(Boolean);

  const loadDemo = () => {
    setJd(DEMO_JD);
    setResumes(DEMO_RESUMES);
    setUploadedFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || resumeList.length === 0) return;
    setStatus('processing');
    setError(null);

    try {
      const res = await fetch('/api/batch-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd, resumes: resumeList }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setStatus('error'); return; }
      onStart(data.candidates);
    } catch {
      setError('Network error.'); setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 flex flex-col">
      {/* Hero */}
      <div className="px-6 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 mb-6">
          <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Blind Screening · 3 Elimination Rounds</span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-white mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">
            Sift
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
          Swipe through candidates like a deck of cards. Blind. Fast. Fair.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {['PDF upload', 'Bias-blind screening', '3 elimination rounds', 'Keyboard ← → support'].map(s => (
            <span key={s} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">{s}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pb-12 max-w-2xl mx-auto w-full">
        {status === 'processing' ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🔍</div>
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-bold">Analyzing {resumeList.length} candidates...</p>
              <p className="text-zinc-400 text-sm mt-1">Anonymizing names, companies, and schools</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Job description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Job Description</label>
              <textarea
                value={jd}
                onChange={e => setJd(e.target.value)}
                placeholder="Paste the job description here..."
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-36 resize-y outline-none focus:border-indigo-500/50 transition"
                required
              />
            </div>

            {/* Resume upload zone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Resumes
                {resumeList.length > 0 && (
                  <span className="ml-2 text-indigo-400 normal-case font-normal">
                    — {resumeList.length} candidate{resumeList.length !== 1 ? 's' : ''} loaded
                  </span>
                )}
              </label>

              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={e => e.target.files && parseFiles(e.target.files)}
                />
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                    <p className="text-zinc-400 text-sm">Extracting text from PDFs...</p>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📄</div>
                    <p className="text-white/70 font-semibold text-sm">Drop PDF or TXT resumes here</p>
                    <p className="text-zinc-500 text-xs mt-1">or click to browse · multiple files supported</p>
                  </>
                )}
              </div>

              {/* Uploaded file list */}
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uploadedFiles.map(f => (
                    <div key={f.name} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${f.ok ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                      <span className={f.ok ? 'text-emerald-300' : 'text-rose-300'}>
                        {f.ok ? '✓' : '✗'} {f.name}
                        {!f.ok && <span className="text-rose-400/70 ml-2">{f.error}</span>}
                      </span>
                      <button type="button" onClick={() => removeFile(f.name)} className="text-white/30 hover:text-white/60 ml-2">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Paste fallback */}
              <details className="mt-3">
                <summary className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-300 transition select-none">
                  Or paste resume text manually
                </summary>
                <div className="mt-2">
                  <textarea
                    value={resumes}
                    onChange={e => setResumes(e.target.value)}
                    placeholder={'Paste resumes here, separated by ---'}
                    className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-32 resize-y outline-none focus:border-indigo-500/50 transition"
                  />
                  <p className="text-zinc-600 text-xs mt-1">Separate resumes with <code className="text-zinc-400">---</code></p>
                </div>
              </details>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={loadDemo}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                Load Demo
              </button>
              <button
                type="submit"
                disabled={resumeList.length === 0 || !jd.trim()}
                className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-bold text-white hover:from-indigo-400 hover:to-violet-400 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                {resumeList.length > 0 ? `Start Sifting → ${resumeList.length} candidate${resumeList.length !== 1 ? 's' : ''}` : 'Start Sifting →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
