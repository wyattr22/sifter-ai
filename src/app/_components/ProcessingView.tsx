'use client';

import type { CandidateProfile } from '@/lib/candidate-schema';

interface Props {
  processed: number;
  total: number;
  candidates: CandidateProfile[];
  onStartEarly: () => void;
}

const LEVEL_EMOJI: Record<string, string> = {
  junior: '🌱', mid: '⚡', senior: '🔥', lead: '👑', principal: '🚀',
};

export function ProcessingView({ processed, total, candidates, onStartEarly }: Props) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const recent = candidates.slice(-6).reverse();
  const eta = processed > 0 ? Math.ceil(((total - processed) / processed) * (processed * 2)) : null;
  const canStart = candidates.length >= 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 flex flex-col px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-4 py-1.5 mb-6">
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Live Processing</span>
        </div>

        <div className="text-8xl font-black text-white tabular-nums">
          {processed}
          <span className="text-zinc-600 text-5xl"> / {total}</span>
        </div>
        <p className="text-zinc-400 mt-2 text-lg">
          {pct < 100 ? `Anonymizing and analyzing candidates...` : `All candidates processed!`}
        </p>
        {eta !== null && pct < 100 && (
          <p className="text-zinc-600 text-sm mt-1">~{eta}s remaining</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="max-w-xl mx-auto w-full mb-10">
        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-600 mt-2">
          <span>Blind screening active</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Live candidate feed */}
      {recent.length > 0 && (
        <div className="max-w-xl mx-auto w-full mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Live feed</p>
          <div className="space-y-2">
            {recent.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-white/4 border border-white/8 px-4 py-3"
                style={{ opacity: 1 - i * 0.12 }}
              >
                <span className="text-xl">{LEVEL_EMOJI[c.careerLevel] ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-semibold">Candidate #{c.id}</span>
                    <span className="text-zinc-500 text-xs capitalize">{c.careerLevel}</span>
                    <span className="text-zinc-600 text-xs">{c.yearsExperience}y exp</span>
                  </div>
                  <p className="text-zinc-500 text-xs truncate mt-0.5">{c.advancePitch}</p>
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

      {/* Start early */}
      <div className="text-center">
        {canStart ? (
          <button
            onClick={onStartEarly}
            className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-3.5 text-sm font-bold text-white hover:from-indigo-400 hover:to-violet-400 transition shadow-lg shadow-indigo-500/20"
          >
            Start Sifting Now → {candidates.length} ready
          </button>
        ) : (
          <p className="text-zinc-600 text-sm">Start Sifting unlocks after 5 candidates are processed...</p>
        )}
      </div>
    </div>
  );
}
