'use client';

import { useState } from 'react';
import type { Screening } from '@/lib/screening-schema';
import { DecisionBadge } from './DecisionBadge';
import { FitScoreGauge } from './FitScoreGauge';
import { StrengthsGaps } from './StrengthsGaps';
import { RecruiterSummary } from './RecruiterSummary';
import { ROISavings } from './ROISavings';
import { SampleDataButton } from './SampleDataButton';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function ScreenerForm() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Screening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screenCount, setScreenCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setStatus('error');
        return;
      }

      setResult(data);
      setScreenCount((c) => c + 1);
      setStatus('done');
    } catch {
      setError('Network error — is the dev server running?');
      setStatus('error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <form onSubmit={handleSubmit}>
        {/* Textareas */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              className="min-h-60 resize-y rounded-xl border border-zinc-200 p-4 font-mono text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Candidate Resume
            </label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste the candidate's resume text here..."
              className="min-h-60 resize-y rounded-xl border border-zinc-200 p-4 font-mono text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3">
          <SampleDataButton
            onLoad={(jd, resume) => {
              setJobDescription(jd);
              setResumeText(resume);
              setResult(null);
              setStatus('idle');
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Analyzing...' : 'Analyze Candidate →'}
          </button>
          {screenCount > 0 && (
            <span className="text-sm text-zinc-400">
              {screenCount} resume{screenCount !== 1 ? 's' : ''} screened this session
            </span>
          )}
        </div>
      </form>

      {/* Loading state */}
      {status === 'loading' && (
        <div className="mt-10">
          <p className="mb-3 text-center text-sm font-medium text-zinc-500">
            Claude is analyzing the candidate...
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-3/4 animate-pulse rounded-full bg-zinc-800" />
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {status === 'done' && result && (
        <div className="mt-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <DecisionBadge decision={result.decision} topReason={result.topReason} />
            </div>
            <FitScoreGauge score={result.fitScore} />
          </div>

          <StrengthsGaps strengths={result.strengths} gaps={result.gaps} />
          <RecruiterSummary recruiterSummary={result.recruiterSummary} />
          <ROISavings count={screenCount} />
        </div>
      )}
    </div>
  );
}
