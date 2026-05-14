'use client';

import { useState } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { SetupForm } from './SetupForm';
import { SwipeView } from './SwipeView';
import { Results } from './Results';
import type { RoundHistory } from './SwipeView';

type View = 'setup' | 'swiping' | 'results';

export function AppClient() {
  const [view, setView] = useState<View>('setup');
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [finalists, setFinalists] = useState<CandidateProfile[]>([]);
  const [history, setHistory] = useState<RoundHistory[]>([]);

  const handleStart = (c: CandidateProfile[]) => {
    setCandidates(c);
    setView('swiping');
  };

  const handleComplete = (f: CandidateProfile[], h: RoundHistory[]) => {
    setFinalists(f);
    setHistory(h);
    setView('results');
  };

  const handleReset = () => {
    setCandidates([]);
    setFinalists([]);
    setHistory([]);
    setView('setup');
  };

  if (view === 'setup') return <SetupForm onStart={handleStart} />;
  if (view === 'swiping') return <SwipeView allCandidates={candidates} onComplete={handleComplete} />;
  return <Results finalists={finalists} history={history} totalCandidates={candidates.length} onReset={handleReset} />;
}
