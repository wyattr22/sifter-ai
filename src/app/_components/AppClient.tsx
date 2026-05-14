'use client';

import { useState, useCallback } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import { ProcessingView } from './ProcessingView';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'processing' | 'swiping' | 'results';

// 3 simultaneous API calls — fast progress, within Groq rate limits
const CONCURRENCY = 3;

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
    let processedCount = 0;

    // Process one resume per API call, CONCURRENCY at a time
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
        // Tick up immediately when this resume finishes (success or fail)
        processedCount += 1;
        setProcessed(processedCount);
      }
    };

    // Run in windows of CONCURRENCY
    for (let i = 0; i < resumes.length; i += CONCURRENCY) {
      const chunk = resumes.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((resume, j) => processOne(resume, i + j)));
      const valid = results.filter(Boolean) as CandidateProfile[];
      if (valid.length > 0) {
        allCandidates.push(...valid);
        setCandidates(prev => [...prev, ...valid]);
      }
    }

    if (allCandidates.length === 0) {
      setProcessingError('All candidates failed to process. The AI service may be busy — try again with fewer resumes.');
      return;
    }

    // Sort by fit score (best first), then start swiping
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
