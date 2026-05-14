'use client';

import type { CandidateProfile } from '@/lib/candidate-schema';

interface Props {
  processed: number;
  total: number;
  candidates: CandidateProfile[];
  error: string | null;
  onReset: () => void;
}

const LEVEL_EMOJI: Record<string, string> = {
  junior: '🌱', mid: '⚡', senior: '🔥', lead: '👑', principal: '🚀',
};

export function ProcessingView({ processed, total, candidates, error, onReset }: Props) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isDone = processed >= total && total > 0;
  const successRate = processed > 0 ? Math.round((candidates.length / processed) * 100) : 0;
  const recent = [...candidates].reverse().slice(0, 5);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-rose-950 to-zinc-950 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-white text-xl font-bold mb-2">Processing failed</p>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <button
            onClick={onReset}
            className="rounded-2xl bg-white/10 border border-white/20 px-8 py-3 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            ← Back to setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 flex flex-col px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 mb-6">
          <span className={`h-2 w-2 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
          <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
            {isDone ? 'Processing Complete' : 'Live Processing'}
          </span>
        </div>

        <div className="text-8xl font-black text-white tabular-nums">
          {processed}
          <span className="text-zinc-600 text-5xl"> / {total}</span>
        </div>
        <p className="text-zinc-400 mt-2 text-lg">
          {isDone
            ? `${candidates.length} candidates screened — sorted by fit score`
            : 'Anonymizing and analyzing candidates...'}
        </p>

        {/* Success rate indicator */}
        {processed > 0 && candidates.length < processed && (
          <p className="text-zinc-600 text-sm mt-1">
            {candidates.length} of {processed} screened successfully ({successRate}%)
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="max-w-xl mx-auto w-full mb-10">
        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDone
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-600 mt-2">
          <span>Blind screening active · 5 criteria evaluated per candidate</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Live candidate feed */}
      {recent.length > 0 && (
        <div className="max-w-xl mx-auto w-full mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              {isDone ? 'Top candidates by fit score' : 'Live feed'}
            </p>
            {isDone && (
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                Sorted
              </span>
            )}
          </div>
          <div className="space-y-2">
            {recent.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-white/4 border border-white/8 px-4 py-3"
                style={{ opacity: isDone ? 1 : 1 - i * 0.15 }}
              >
                <span className="text-xl">{LEVEL_EMOJI[c.careerLevel] ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">Candidate #{c.id}</span>
                    <span className="text-zinc-500 text-xs capitalize">{c.careerLevel}</span>
                    <span className="text-zinc-600 text-xs">{c.yearsExperience}y exp</span>
                  </div>
                  <p className="text-zinc-500 text-xs truncate mt-0.5">
                    {c.scoreBreakdown || c.advancePitch}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${c.fitScore >= 75 ? 'text-emerald-400' : c.fitScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {c.fitScore}
                  </p>
                  <p className="text-zinc-600 text-[10px]">fit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status footer */}
      <div className="text-center">
        {isDone ? (
          <p className="text-emerald-400/70 text-sm font-semibold animate-pulse">
            Starting swipe view...
          </p>
        ) : (
          <p className="text-zinc-600 text-sm">
            Evaluating: skills · experience · scale · achievements · domain fit
          </p>
        )}
      </div>
    </div>
  );
}
