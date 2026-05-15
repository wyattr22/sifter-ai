'use client';

import { useState, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import { ProcessingView } from './ProcessingView';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'processing' | 'swiping' | 'results';

// 5 resumes per batch → 8 calls for 40 resumes, all fired simultaneously
const BATCH_SIZE = 5;

// 20% of input, min 10 (enough cards to swipe), max 40 (rate limit budget)
// 10 → 10, 25 → 10, 50 → 10, 100 → 20, 200 → 40
function preFilterCount(total: number): number {
  return Math.max(10, Math.min(Math.round(total * 0.2), 40));
}

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
}

// Common and JD-boilerplate words that appear in almost every resume — not useful signals
const STOPWORDS = new Set([
  'the','and','for','are','with','has','have','this','that','from','will','been',
  'more','than','your','our','their','you','can','not','all','any','its','they',
  'who','what','when','where','how','was','were','able','well','also','into',
  'such','each','which','there','then','only','both','very','just','over',
  // JD boilerplate present in nearly every resume
  'years','year','experience','experienced','working','work','strong','team','teams',
  'build','building','built','using','skills','skill','knowledge','develop','role',
  'position','required','requirements','preferred','including','support','manage',
  'environment','company','business','solutions','system','good','great','plus',
  'looking','seeking','help','ensure','drive','lead','make','ability','level',
]);

function roughScore(jobDescription: string, resume: string): number {
  const jdTokens = Array.from(new Set(
    (jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [])
      .filter(w => !STOPWORDS.has(w))
  ));
  if (jdTokens.length === 0) return 0;
  const resumeLower = resume.toLowerCase();
  // Weight by specificity: words 7+ chars are likely technical terms (PostgreSQL, DynamoDB, etc.)
  let matched = 0, total = 0;
  for (const token of jdTokens) {
    const weight = token.length >= 7 ? 2 : 1;
    total += weight;
    if (resumeLower.includes(token)) matched += weight;
  }
  return total > 0 ? matched / total : 0;
}

export function AppClient() {
  const [view, setView] = useState<View>('setup');
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [preFiltered, setPreFiltered] = useState<{ original: number; analyzed: number } | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [finalists, setFinalists] = useState<CandidateProfile[]>([]);
  const [history, setHistory] = useState<RoundHistory[]>([]);

  const runBatchProcessing = useCallback(async ({ jobDescription, resumes }: SetupPayload) => {
    setView('processing');
    setProcessed(0);
    setCandidates([]);
    setProcessingError(null);
    setPreFiltered(null);

    // ── Step 1: Instant client-side pre-filter ─────────────────────────────
    // Score all resumes by keyword overlap with JD — no API call needed
    const scored = resumes
      .map((resume, i) => ({ resume, i, score: roughScore(jobDescription, resume) }))
      .sort((a, b) => b.score - a.score);

    const topN = Math.min(preFilterCount(resumes.length), resumes.length);
    const topResumes = scored.slice(0, topN);

    setPreFiltered({ original: resumes.length, analyzed: topN });
    setTotal(topN);

    // ── Step 2: AI deep analysis — batch 5 resumes per Groq call (8 calls vs 40) ──
    const allCandidates: CandidateProfile[] = [];
    let processedCount = 0;

    const fetchCandidates = async (resumes: string[]): Promise<CandidateProfile[]> => {
      const res = await fetch('/api/batch-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.candidates ?? []) as CandidateProfile[];
    };

    const processBatch = async (
      batch: { resume: string; i: number }[],
    ): Promise<CandidateProfile[]> => {
      let raws: CandidateProfile[] = [];

      // Try the whole batch up to 2 times
      for (let t = 0; t < 2 && raws.length < batch.length; t++) {
        try {
          if (t > 0) await new Promise(r => setTimeout(r, 1500));
          raws = await fetchCandidates(batch.map(b => b.resume));
        } catch { /* retry */ }
      }

      // If still short, fetch each missing resume individually
      if (raws.length < batch.length) {
        const missing = batch.slice(raws.length);
        const singles = await Promise.allSettled(
          missing.map(item =>
            fetchCandidates([item.resume]).then(r => r[0] ?? null).catch(() => null)
          )
        );
        for (const s of singles) {
          if (s.status === 'fulfilled' && s.value) raws.push(s.value as CandidateProfile);
        }
      }

      processedCount += batch.length;
      setProcessed(processedCount);

      return raws
        .slice(0, batch.length)
        .map((raw, idx) => ({ ...raw, id: String((batch[idx]?.i ?? idx) + 1) }));
    };

    // Split into batches and fire all simultaneously — provider rotation handles rate limits
    const batches: { resume: string; i: number }[][] = [];
    for (let i = 0; i < topResumes.length; i += BATCH_SIZE) {
      batches.push(topResumes.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(batches.map(async (batch) => {
      const results = await processBatch(batch);
      const valid = results.filter(Boolean) as CandidateProfile[];
      if (valid.length > 0) {
        allCandidates.push(...valid);
        setCandidates(prev => [...prev, ...valid]);
      }
    }));

    if (allCandidates.length === 0) {
      setProcessingError('All candidates failed to process. The AI service may be busy — try again.');
      return;
    }

    const sorted = [...allCandidates].sort((a, b) => b.fitScore - a.fitScore);
    setCandidates(sorted);
    setView('swiping');
  }, []);

  const handleComplete = (f: CandidateProfile[], h: RoundHistory[]) => {
    setFinalists(f);
    setHistory(h);
    setView('results');
  };

  const handleReset = () => {
    setCandidates([]);
    setFinalists([]);
    setHistory([]);
    setProcessed(0);
    setTotal(0);
    setPreFiltered(null);
    setProcessingError(null);
    setView('setup');
  };

  if (view === 'setup') return <SetupForm onStart={runBatchProcessing} />;

  if (view === 'processing') return (
    <ProcessingView
      processed={processed}
      total={total}
      candidates={candidates}
      preFiltered={preFiltered}
      error={processingError}
      onReset={handleReset}
    />
  );

  if (view === 'swiping') return (
    <SwipeView allCandidates={candidates} onComplete={handleComplete} />
  );

  return (
    <Results
      finalists={finalists}
      history={history}
      totalCandidates={candidates.length}
      onReset={handleReset}
    />
  );
}
