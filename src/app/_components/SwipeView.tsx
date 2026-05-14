'use client';

import { useEffect, useCallback, useState } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { ROUNDS } from '@/lib/candidate-schema';
import { CandidateCard } from './CandidateCard';

interface Props {
  allCandidates: CandidateProfile[];
  onComplete: (finalists: CandidateProfile[], history: RoundHistory[]) => void;
}

export interface RoundHistory {
  round: number;
  decisions: Record<string, 'advance' | 'reject'>;
}

const ROUND_BG = [
  'from-blue-600 via-indigo-700 to-violet-900',
  'from-violet-600 via-purple-700 to-fuchsia-900',
  'from-emerald-600 via-teal-700 to-cyan-900',
];

export function SwipeView({ allCandidates, onComplete }: Props) {
  const [round, setRound] = useState(0);
  const [queue, setQueue] = useState<CandidateProfile[]>(allCandidates);
  const [decisions, setDecisions] = useState<Record<string, 'advance' | 'reject'>>({});
  const [history, setHistory] = useState<RoundHistory[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [swipingId, setSwipingId] = useState<string | null>(null);

  const currentCandidate = queue[topIndex];
  const remaining = queue.length - topIndex;

  const handleSwipe = useCallback((candidateId: string, dir: 'left' | 'right') => {
    setSwipingId(candidateId);
    setTimeout(() => {
      setDecisions(prev => ({ ...prev, [candidateId]: dir === 'right' ? 'advance' : 'reject' }));
      setTopIndex(i => i + 1);
      setSwipingId(null);
    }, 50);
  }, []);

  // When all cards in round are done
  useEffect(() => {
    if (topIndex < queue.length) return;
    if (topIndex === 0) return;

    const advanced = queue.filter(c => decisions[c.id] === 'advance');
    const roundHistory: RoundHistory = { round, decisions: { ...decisions } };
    const newHistory = [...history, roundHistory];

    if (round + 1 >= ROUNDS.length || advanced.length === 0) {
      onComplete(advanced, newHistory);
    } else {
      setHistory(newHistory);
      setRound(r => r + 1);
      setQueue(advanced);
      setDecisions({});
      setTopIndex(0);
    }
  }, [topIndex, queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentCandidate || swipingId) return;
      if (e.key === 'ArrowRight') handleSwipe(currentCandidate.id, 'right');
      if (e.key === 'ArrowLeft') handleSwipe(currentCandidate.id, 'left');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentCandidate, swipingId, handleSwipe]);

  const roundInfo = ROUNDS[round];
  const pct = Math.round(((topIndex) / queue.length) * 100);

  if (!currentCandidate) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${ROUND_BG[round]} flex items-center justify-center`}>
        <div className="text-center text-white">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl font-bold">Tallying results...</p>
        </div>
      </div>
    );
  }

  const visibleCards = queue.slice(topIndex, topIndex + 3);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${ROUND_BG[round]} flex flex-col`}>
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        {/* Round pills */}
        <div className="flex justify-center gap-2 mb-5">
          {ROUNDS.map((r, i) => (
            <div
              key={r.name}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                i === round
                  ? 'bg-white text-zinc-900 shadow-lg'
                  : i < round
                  ? 'bg-white/20 text-white/70 line-through'
                  : 'bg-white/10 text-white/40'
              }`}
            >
              {r.label}: {r.name}
            </div>
          ))}
        </div>

        {/* Round info */}
        <div className="text-center mb-3">
          <p className="text-white/60 text-sm font-medium">{roundInfo.focus}</p>
        </div>

        {/* Progress */}
        <div className="max-w-sm mx-auto">
          <div className="flex justify-between text-xs text-white/60 mb-1.5">
            <span>{remaining} remaining</span>
            <span>{pct}% done</span>
          </div>
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative w-full max-w-sm" style={{ height: 420 }}>
          {visibleCards.map((candidate, idx) => (
            <CandidateCard
              key={`${round}-${candidate.id}`}
              candidate={candidate}
              position={idx}
              round={round}
              onSwipe={(dir) => handleSwipe(candidate.id, dir)}
            />
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-10">
        <div className="flex items-center justify-center gap-8 mb-4">
          {/* Reject button */}
          <button
            onClick={() => currentCandidate && handleSwipe(currentCandidate.id, 'left')}
            className="h-16 w-16 rounded-full bg-white/10 border-2 border-rose-400 text-rose-400 text-2xl font-bold hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            ✗
          </button>

          <div className="text-center">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
              ← Reject · Advance →
            </p>
          </div>

          {/* Advance button */}
          <button
            onClick={() => currentCandidate && handleSwipe(currentCandidate.id, 'right')}
            className="h-16 w-16 rounded-full bg-white/10 border-2 border-emerald-400 text-emerald-400 text-2xl font-bold hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            ✓
          </button>
        </div>

        <p className="text-center text-white/30 text-xs">
          Blind screening active — names and companies hidden to reduce bias
        </p>
      </div>
    </div>
  );
}
