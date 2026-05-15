'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import { ROUNDS } from '@/lib/candidate-schema';
import { CandidateCard } from './CandidateCard';

interface Props {
  allCandidates: CandidateProfile[];
  onComplete: (finalists: CandidateProfile[], history: RoundHistory[], notes: Record<string, string>) => void;
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
  const [undoFlash, setUndoFlash] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);

  // Permanent rank map from initial sorted order (best fit = rank 1)
  const rankMap = useMemo(
    () => Object.fromEntries(allCandidates.map((c, i) => [c.id, i + 1])),
    [allCandidates]
  );

  const currentCandidate = queue[topIndex];
  const remaining = queue.length - topIndex;

  const handleSwipe = useCallback((candidateId: string, dir: 'left' | 'right') => {
    setSwipingId(candidateId);
    setNoteOpen(false);
    setTimeout(() => {
      setDecisions(prev => ({ ...prev, [candidateId]: dir === 'right' ? 'advance' : 'reject' }));
      setTopIndex(i => i + 1);
      setSwipingId(null);
    }, 50);
  }, []);

  const handleUndo = useCallback(() => {
    if (swipingId) return;
    setTopIndex(prev => {
      if (prev === 0) return prev;
      const lastCandidate = queue[prev - 1];
      setDecisions(d => {
        const next = { ...d };
        delete next[lastCandidate.id];
        return next;
      });
      setUndoFlash(true);
      setTimeout(() => setUndoFlash(false), 600);
      return prev - 1;
    });
  }, [queue, swipingId]);

  // When all cards in round are done
  useEffect(() => {
    if (topIndex < queue.length) return;
    if (topIndex === 0) return;

    const advanced = queue.filter(c => decisions[c.id] === 'advance');
    const roundHistory: RoundHistory = { round, decisions: { ...decisions } };
    const newHistory = [...history, roundHistory];

    if (round + 1 >= ROUNDS.length || advanced.length === 0) {
      onComplete(advanced, newHistory, notes);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); handleUndo(); return; }
      if (!currentCandidate || swipingId) return;
      if (e.key === 'ArrowRight') handleSwipe(currentCandidate.id, 'right');
      if (e.key === 'ArrowLeft') handleSwipe(currentCandidate.id, 'left');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentCandidate, swipingId, handleSwipe, handleUndo]);

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
          <p className="text-white/80 text-sm font-bold">{roundInfo.focus}</p>
          <p className="text-white/40 text-xs mt-1 max-w-xs mx-auto leading-relaxed">{roundInfo.explain}</p>
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
        <div className="relative w-full max-w-sm" style={{ height: 460 }}>
          {visibleCards.map((candidate, idx) => (
            <CandidateCard
              key={`${round}-${candidate.id}`}
              candidate={candidate}
              position={idx}
              round={round}
              rank={rankMap[candidate.id] ?? 0}
              totalCandidates={allCandidates.length}
              onSwipe={(dir) => handleSwipe(candidate.id, dir)}
            />
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-10">
        {/* Note input */}
        <div className="max-w-sm mx-auto mb-3">
          {noteOpen ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={currentCandidate ? (notes[currentCandidate.id] ?? '') : ''}
                onChange={e => currentCandidate && setNotes(prev => ({ ...prev, [currentCandidate.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Escape' && setNoteOpen(false)}
                placeholder="Add a note about this candidate..."
                className="flex-1 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 px-3 py-2 text-sm outline-none focus:border-white/40"
              />
              <button onClick={() => setNoteOpen(false)} className="text-white/40 hover:text-white px-2 text-sm">Done</button>
            </div>
          ) : (
            <button
              onClick={() => setNoteOpen(true)}
              className="w-full text-center text-white/30 hover:text-white/60 text-xs py-1.5 transition flex items-center justify-center gap-1.5"
            >
              {currentCandidate && notes[currentCandidate.id]
                ? <><span className="text-amber-300/70">✎</span> <span className="text-amber-300/70 truncate max-w-xs">{notes[currentCandidate.id]}</span></>
                : <><span>✎</span> Add note</>
              }
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-5 mb-4">
          <button
            onClick={() => currentCandidate && handleSwipe(currentCandidate.id, 'left')}
            className="h-16 w-16 rounded-full bg-white/10 border-2 border-rose-400 text-rose-400 text-2xl font-bold hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            ✗
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={topIndex === 0 || !!swipingId}
              className={`h-9 w-9 rounded-full border text-sm font-bold transition-all active:scale-95 ${
                undoFlash
                  ? 'bg-white text-zinc-900 border-white scale-110'
                  : topIndex === 0
                  ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
                  : 'bg-white/10 border-white/30 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
              title="Undo last swipe (⌘Z)"
            >
              ↩
            </button>
            <p className="text-white/40 text-[9px] font-semibold uppercase tracking-widest">
              ← Reject · Advance →
            </p>
          </div>

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
