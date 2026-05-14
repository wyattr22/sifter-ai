'use client';

import { useState } from 'react';
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
6 years Python, 3 years Django REST Framework, PostgreSQL daily. Built analytics pipeline handling 200k events/day on AWS Lambda + RDS. Docker, some Redis. B.S. Computer Science from a state school. Solo contributor but reads architecture well.
---
2 years experience. Python bootcamp graduate, built 3 Django tutorial projects. No production experience. MySQL. Eager, quick learner. Would be a junior hire at best.`;

interface Props {
  onStart: (candidates: CandidateProfile[]) => void;
}

export function SetupForm({ onStart }: Props) {
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const resumeList = resumes.split('---').map(r => r.trim()).filter(Boolean);

  const loadDemo = () => {
    setJd(DEMO_JD);
    setResumes(DEMO_RESUMES);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || resumeList.length === 0) return;
    setStatus('processing');
    setError(null);
    setProgress(`Analyzing ${resumeList.length} candidates...`);

    try {
      const res = await fetch('/api/batch-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd, resumes: resumeList }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setStatus('error');
        return;
      }

      onStart(data.candidates);
    } catch {
      setError('Network error — is the server running?');
      setStatus('error');
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

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {['3 elimination rounds', 'Bias-blind screening', 'Keyboard ← → support', '< 5s per candidate'].map(s => (
            <span key={s} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-12 max-w-2xl mx-auto w-full">
        {status === 'processing' ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🔍</div>
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-bold">{progress}</p>
              <p className="text-zinc-400 text-sm mt-1">Anonymizing names, companies, and schools</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Job description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Job Description
              </label>
              <textarea
                value={jd}
                onChange={e => setJd(e.target.value)}
                placeholder="Paste the job description here..."
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-36 resize-y outline-none focus:border-indigo-500/50 focus:bg-white/8 transition"
                required
              />
            </div>

            {/* Resumes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Resumes
                {resumeList.length > 0 && (
                  <span className="ml-2 text-indigo-400 normal-case font-normal">
                    — {resumeList.length} candidate{resumeList.length !== 1 ? 's' : ''} detected
                  </span>
                )}
              </label>
              <textarea
                value={resumes}
                onChange={e => setResumes(e.target.value)}
                placeholder={'Paste resume text here. Separate multiple resumes with ---\n\nExample:\nJohn Smith, 5 years Python...\n---\nJane Doe, 3 years Django...'}
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 p-4 text-sm font-mono min-h-48 resize-y outline-none focus:border-indigo-500/50 focus:bg-white/8 transition"
                required
              />
              <p className="text-zinc-600 text-xs mt-1.5">Separate resumes with <code className="text-zinc-400">---</code> on its own line. Max 10 candidates.</p>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={loadDemo}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                Load Demo (5 candidates)
              </button>
              <button
                type="submit"
                disabled={resumeList.length === 0 || !jd.trim()}
                className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-bold text-white hover:from-indigo-400 hover:to-violet-400 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                Start Sifting → {resumeList.length > 0 && `${resumeList.length} candidates`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
