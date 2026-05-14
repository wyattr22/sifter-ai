'use client';

import { useState } from 'react';
import type { Screening } from '@/lib/screening-schema';

export function RecruiterSummary({ recruiterSummary }: Pick<Screening, 'recruiterSummary'>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(recruiterSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Recruiter Summary — ready to share
        </h3>
        <button
          onClick={handleCopy}
          className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-zinc-700">{recruiterSummary}</p>
    </div>
  );
}
