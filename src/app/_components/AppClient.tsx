'use client';

import { useState, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import { ProcessingView } from './ProcessingView';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'processing' | 'swiping' | 'results';

// 5 simultaneous AI calls — fast progress within Groq limits
const CONCURRENCY = 5;
// Only AI-analyze the top candidates by keyword match; rest are pre-filtered out
const PRE_FILTER_TOP = 40;

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
}

// Common words to ignore during keyword matching
const STOPWORDS = new Set([
  'the','and','for','are','with','has','have','this','that','from','will','been',
  'more','than','your','our','their','you','can','not','all','any','its','they',
  'who','what','when','where','how','was','were','able','well','also','into',
  'such','each','which','their','there','then','only','both','very','just','over',
]);

function roughScore(jobDescription: string, resume: string): number {
  const jdTokens = Array.from(new Set(
    (jobDescription.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [])
      .filter(w => !STOPWORDS.has(w))
  ));
  if (jdTokens.length === 0) return 0;
  const resumeLower = resume.toLowerCase();
  const matched = jdTokens.filter(t => resumeLower.includes(t));
  return matched.length / jdTokens.length;
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

    const topN = Math.min(PRE_FILTER_TOP, resumes.length);
    const topResumes = scored.slice(0, topN);

    setPreFiltered({ original: resumes.length, analyzed: topN });
    setTotal(topN);

    // ── Step 2: AI deep analysis on top candidates only ────────────────────
    const allCandidates: CandidateProfile[] = [];
    let processedCount = 0;

    const processOne = async (resume: string, index: number): Promise<CandidateProfile | null> => {
      try {
        const res = await fetch('/api/batch-screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription, resumes: [resume] }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        const raw = data.candidates?.[0];
        if (!raw) return null;

        return { ...raw, id: String(index + 1) } as CandidateProfile;
      } catch {
        return null;
      } finally {
        processedCount += 1;
        setProcessed(processedCount);
      }
    };

    for (let i = 0; i < topResumes.length; i += CONCURRENCY) {
      const chunk = topResumes.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(({ resume, i: origIdx }) => processOne(resume, origIdx)));
      const valid = results.filter(Boolean) as CandidateProfile[];
      if (valid.length > 0) {
        allCandidates.push(...valid);
        setCandidates(prev => [...prev, ...valid]);
      }
    }

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
