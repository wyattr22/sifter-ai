'use client';

import { useState } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';
import type { RoundHistory } from './SwipeView';
import { ROUNDS } from '@/lib/candidate-schema';

interface Props {
  finalists: CandidateProfile[];
  allCandidates: CandidateProfile[];
  history: RoundHistory[];
  notes: Record<string, string>;
  totalCandidates: number;
  onReset: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  junior: 'bg-sky-100 text-sky-700',
  mid: 'bg-violet-100 text-violet-700',
  senior: 'bg-amber-100 text-amber-700',
  lead: 'bg-rose-100 text-rose-700',
  principal: 'bg-emerald-100 text-emerald-700',
};

function exportCSV(sorted: CandidateProfile[], notes: Record<string, string>) {
  const headers = ['Rank','Candidate','Career Level','Years Exp','Fit Score','Skills','Experience','Scale','Impact','Domain','Decision','Top Achievement','Required Found','Required Missing','Bonus Skills','Recruiter Summary','Note'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = sorted.map((c, i) => [
    i + 1, `Candidate #${c.id}`, c.careerLevel, c.yearsExperience,
    c.fitScore, c.skillsScore, c.experienceScore, c.scaleScore, c.achievementScore, c.domainScore,
    c.fitScore >= 75 ? 'ADVANCE' : c.fitScore >= 50 ? 'HOLD' : 'REJECT',
    c.topAchievement, c.requiredSkillsFound.join('; '), c.requiredSkillsMissing.join('; '),
    c.bonusSkills.join('; '), c.recruiterSummary, notes[c.id] ?? '',
  ].map(esc).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sifter-finalists-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Results({ finalists, allCandidates, history, notes, totalCandidates, onReset }: Props) {
  const [showRejected, setShowRejected] = useState(false);
  const sorted = [...finalists].sort((a, b) => b.fitScore - a.fitScore);

  const finalistIds = new Set(finalists.map(f => f.id));
  const rejected = allCandidates
    .filter(c => !finalistIds.has(c.id))
    .sort((a, b) => b.fitScore - a.fitScore);

  // Find which round each candidate was eliminated in
  const eliminatedInRound = (id: string): number => {
    for (let i = 0; i < history.length; i++) {
      if (history[i].decisions[id] === 'reject') return i;
    }
    return -1;
  };
  const eliminated = totalCandidates - finalists.length;
  const minutesSaved = totalCandidates * 3;
  const dollarsSaved = (minutesSaved / 60) * 35;

  // Who got eliminated in each round
  const eliminationByRound = ROUNDS.map((_, i) => {
    const roundHistory = history[i];
    if (!roundHistory) return 0;
    return Object.values(roundHistory.decisions).filter(d => d === 'reject').length;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-4 py-1.5 mb-4">
          <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Screening Complete</span>
        </div>
        <h1 className="text-5xl font-black mb-2">
          {finalists.length === 0 ? 'No Finalists' : `${finalists.length} Made It`}
        </h1>
        <p className="text-zinc-400 text-lg">
          {finalists.length === 0
            ? 'All candidates were eliminated. Try loosening your criteria.'
            : `${eliminated} eliminated across ${history.length} rounds`}
        </p>
      </div>

      {/* ROI Banner */}
      <div className="mx-6 mb-6 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Time Saved</p>
            <p className="text-4xl font-black text-amber-300">{minutesSaved} min</p>
            <p className="text-amber-400/70 text-sm">{totalCandidates} candidates × 3 min each</p>
          </div>
          <div className="text-right">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">$ Saved</p>
            <p className="text-4xl font-black text-amber-300">${dollarsSaved.toFixed(0)}</p>
            <p className="text-amber-400/70 text-sm">at $35/hr recruiter rate</p>
          </div>
        </div>
      </div>

      {/* Funnel breakdown */}
      <div className="mx-6 mb-6 rounded-2xl bg-white/5 border border-white/10 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Elimination Funnel</p>
        <div className="flex items-end gap-2 justify-between">
          <div className="text-center">
            <div className="text-2xl font-black text-white">{totalCandidates}</div>
            <div className="text-xs text-zinc-400 mt-1">Started</div>
          </div>
          {eliminationByRound.map((count, i) => (
            <div key={i} className="flex items-center gap-2 text-center">
              <div className="text-zinc-500">→</div>
              <div>
                <div className="text-sm font-bold text-rose-400">−{count}</div>
                <div className="text-xs text-zinc-500">{ROUNDS[i].name}</div>
              </div>
            </div>
          ))}
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-400">{finalists.length}</div>
            <div className="text-xs text-zinc-400 mt-1">Finalists</div>
          </div>
        </div>
      </div>

      {/* Finalist cards */}
      {sorted.length > 0 && (
        <div className="mx-6 mb-8 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Finalists — ranked by fit score
          </p>
          {sorted.map((c, rank) => (
            <div
              key={c.id}
              className="rounded-2xl bg-white/8 border border-white/10 p-5 flex items-start gap-4"
            >
              <div className="shrink-0">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-black ${
                  rank === 0 ? 'bg-amber-400 text-amber-900' :
                  rank === 1 ? 'bg-zinc-300 text-zinc-700' :
                  rank === 2 ? 'bg-amber-700 text-amber-100' :
                  'bg-white/10 text-zinc-400'
                }`}>
                  {rank + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-bold text-white">Candidate #{c.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLORS[c.careerLevel] ?? 'bg-zinc-100 text-zinc-700'}`}>
                    {c.careerLevel}
                  </span>
                  <span className="text-zinc-400 text-sm">{c.yearsExperience} yrs</span>
                </div>
                <p className="text-zinc-300 text-sm mb-2 italic">"{c.topAchievement}"</p>
                <div className="flex gap-3 text-xs mb-2">
                  <span className="text-blue-400">Skills {c.skillsScore}</span>
                  <span className="text-violet-400">Exp {c.experienceScore}</span>
                  <span className="text-emerald-400 font-bold">Fit {c.fitScore}</span>
                </div>
                {notes[c.id] && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <span className="text-amber-400 text-xs mt-px shrink-0">✎</span>
                    <p className="text-amber-200/80 text-xs leading-relaxed">{notes[c.id]}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejected candidates */}
      {rejected.length > 0 && (
        <div className="mx-6 mb-6">
          <button
            onClick={() => setShowRejected(o => !o)}
            className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-5 py-3.5 text-left hover:bg-white/8 transition"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Eliminated Candidates</p>
              <p className="text-zinc-600 text-xs mt-0.5">{rejected.length} candidates — click to review who was cut and why</p>
            </div>
            <span className="text-zinc-500 text-sm">{showRejected ? '▲' : '▼'}</span>
          </button>

          {showRejected && (
            <div className="mt-2 space-y-2">
              {rejected.map(c => {
                const roundIdx = eliminatedInRound(c.id);
                const decision = c.fitScore >= 75 ? 'ADVANCE' : c.fitScore >= 50 ? 'HOLD' : 'REJECT';
                return (
                  <div key={c.id} className="rounded-xl bg-white/5 border border-white/8 px-4 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${decision === 'HOLD' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-zinc-300 text-xs font-bold">Candidate #{c.id}</span>
                        <span className="text-zinc-500 text-xs">{c.yearsExperience} yrs · {c.careerLevel}</span>
                        <span className="text-zinc-600 text-xs">fit {c.fitScore}</span>
                        {roundIdx >= 0 && (
                          <span className="text-zinc-600 text-[10px] bg-white/5 rounded-full px-2 py-0.5">
                            cut R{roundIdx + 1}: {ROUNDS[roundIdx].name}
                          </span>
                        )}
                      </div>
                      {c.recruiterSummary && (
                        <p className="text-zinc-500 text-xs leading-relaxed">{c.recruiterSummary}</p>
                      )}
                      {c.requiredSkillsMissing.length > 0 && (
                        <p className="text-rose-400/60 text-[10px] mt-0.5">
                          Missing: {c.requiredSkillsMissing.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-6 pb-12 flex flex-col items-center gap-3">
        {sorted.length > 0 && (
          <button
            onClick={() => exportCSV(sorted, notes)}
            className="rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-8 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 transition-all"
          >
            ↓ Export Finalists to CSV
          </button>
        )}
        <button
          onClick={onReset}
          className="rounded-2xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          ← Screen Another Role
        </button>
      </div>
    </div>
  );
}
