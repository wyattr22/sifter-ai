'use client';

import { useState, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import { ProcessingView } from './ProcessingView';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'processing' | 'swiping' | 'results';

const BATCH_SIZE = 3; // Reduced to avoid Groq rate limits

interface SetupPayload {
  jobDescription: string;
  resumes: string[];
}

export function AppClient() {
  const [view, setView] = useState<View>('setup');
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [finalists, setFinalists] = useState<CandidateProfile[]>([]);
  const [history, setHistory] = useState<RoundHistory[]>([]);

  const runBatchProcessing = useCallback(async ({ jobDescription, resumes }: SetupPayload) => {
    setView('processing');
    setTotal(resumes.length);
    setProcessed(0);
    setCandidates([]);
    setProcessingError(null);

    const allCandidates: CandidateProfile[] = [];

    for (let i = 0; i < resumes.length; i += BATCH_SIZE) {
      const batch = resumes.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch('/api/batch-screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription, resumes: batch }),
        });

        // Always advance the progress counter regardless of success/failure
        setProcessed(prev => prev + batch.length);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Batch failed:', err);
          continue;
        }

        const data = await res.json();
        const batchCandidates: CandidateProfile[] = (data.candidates ?? []).map(
          (c: CandidateProfile, j: number) => ({ ...c, id: String(i + j + 1) })
        );

        allCandidates.push(...batchCandidates);
        setCandidates(prev => [...prev, ...batchCandidates]);
      } catch (err) {
        console.error('Batch fetch error:', err);
        setProcessed(prev => prev + batch.length);
      }
    }

    if (allCandidates.length === 0) {
      setProcessingError('All candidates failed to process. Check your internet connection or try fewer resumes.');
      return;
    }

    // Sort by fit score (highest first) then start swiping
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
    setProcessingError(null);
    setView('setup');
  };

  if (view === 'setup') return <SetupForm onStart={runBatchProcessing} />;

  if (view === 'processing') return (
    <ProcessingView
      processed={processed}
      total={total}
      candidates={candidates}
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
