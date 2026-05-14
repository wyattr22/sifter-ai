'use client';

import { useState, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import { ProcessingView } from './ProcessingView';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'processing' | 'swiping' | 'results';

const BATCH_SIZE = 5;

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
}

export function AppClient() {
  const [view, setView] = useState<View>('setup');
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [finalists, setFinalists] = useState<CandidateProfile[]>([]);
  const [history, setHistory] = useState<RoundHistory[]>([]);

  const runBatchProcessing = useCallback(async ({ jobDescription, resumes }: SetupPayload) => {
    setView('processing');
    setTotal(resumes.length);
    setProcessed(0);
    setCandidates([]);

    const allCandidates: CandidateProfile[] = [];

    // Process in batches of BATCH_SIZE to stay within API rate limits
    for (let i = 0; i < resumes.length; i += BATCH_SIZE) {
      const batch = resumes.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch('/api/batch-screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription, resumes: batch }),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const batchCandidates: CandidateProfile[] = (data.candidates ?? []).map(
          (c: CandidateProfile, j: number) => ({ ...c, id: String(i + j + 1) })
        );

        allCandidates.push(...batchCandidates);
        setCandidates(prev => [...prev, ...batchCandidates]);
        setProcessed(prev => prev + batch.length);
      } catch {
        setProcessed(prev => prev + batch.length);
      }
    }
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
    setView('setup');
  };

  if (view === 'setup') return <SetupForm onStart={runBatchProcessing} />;

  if (view === 'processing') return (
    <ProcessingView
      processed={processed}
      total={total}
      candidates={candidates}
      onStartEarly={() => setView('swiping')}
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
