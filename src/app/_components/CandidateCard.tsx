'use client';

import { useRef, useState } from 'react';
import type { CandidateProfile } from '@/lib/candidate-schema';

interface Props {
  candidate: CandidateProfile;
  position: number;
  round: number;
  rank: number;
  totalCandidates: number;
  onSwipe: (direction: 'left' | 'right') => void;
}

const THRESHOLD = 80;

const LEVEL_COLORS: Record<string, string> = {
  junior: 'bg-sky-100 text-sky-700',
  mid: 'bg-violet-100 text-violet-700',
  senior: 'bg-amber-100 text-amber-700',
  lead: 'bg-rose-100 text-rose-700',
  principal: 'bg-emerald-100 text-emerald-700',
};

const ROUND_ACCENTS = ['from-blue-500', 'from-violet-500', 'from-emerald-500'];

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%`, transition: 'width 0.6s ease' }}
        />
      </div>
      <span className="text-xs font-bold text-zinc-500 w-8 text-right">{score}</span>
    </div>
  );
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;
  return (
    <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
      isTop3 ? 'bg-amber-100 text-amber-700' : isTop10 ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-50 text-zinc-400'
    }`}>
      {isTop3 && <span>{['🥇','🥈','🥉'][rank - 1]}</span>}
      <span>#{rank} of {total}</span>
    </div>
  );
}

export function CandidateCard({ candidate, position, round, rank, totalCandidates, onSwipe }: Props) {
  const [dragX, setDragX] = useState(0);
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const isTop = position === 0;

  const triggerSwipe = (dir: 'left' | 'right') => {
    if (flying) return;
    setFlying(dir);
    setDragX(dir === 'right' ? 700 : -700);
    setTimeout(() => onSwipe(dir), 320);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop || flying) return;
    dragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !isTop) return;
    setDragX(e.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > THRESHOLD) triggerSwipe('right');
    else if (dragX < -THRESHOLD) triggerSwipe('left');
    else setDragX(0);
  };

  const rotation = isTop ? dragX * 0.07 : 0;
  const advOpacity = Math.min(Math.max(dragX / THRESHOLD, 0), 1);
  const rejOpacity = Math.min(Math.max(-dragX / THRESHOLD, 0), 1);

  const scaleArr = [1, 0.95, 0.91];
  const yArr = [0, 14, 28];

  const cardStyle: React.CSSProperties = isTop
    ? {
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: dragging.current ? 'none' : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
        cursor: dragging.current ? 'grabbing' : 'grab',
        zIndex: 10,
        touchAction: 'none',
      }
    : {
        transform: `scale(${scaleArr[position] ?? 0.87}) translateY(${yArr[position] ?? 42}px)`,
        transition: 'transform 0.3s ease',
        zIndex: 10 - position,
        pointerEvents: 'none' as const,
      };

  return (
    <div
      style={cardStyle}
      className="absolute inset-x-0 flex justify-center"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden select-none">
        {/* Colored top strip per round */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${ROUND_ACCENTS[round]} to-transparent`} />

        {/* Stamp overlays */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-5" style={{ opacity: advOpacity }}>
          <div className="rotate-[-18deg] rounded-xl border-4 border-emerald-500 px-3 py-1">
            <span className="text-2xl font-black tracking-wider text-emerald-500">ADVANCE</span>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-start justify-start p-5" style={{ opacity: rejOpacity }}>
          <div className="rotate-[18deg] rounded-xl border-4 border-rose-500 px-3 py-1">
            <span className="text-2xl font-black tracking-wider text-rose-500">REJECT</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  Blind Candidate
                </p>
                <RankBadge rank={rank} total={totalCandidates} />
              </div>
              <p className="text-2xl font-black text-zinc-900">
                {candidate.yearsExperience} yrs exp
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${LEVEL_COLORS[candidate.careerLevel] ?? 'bg-zinc-100 text-zinc-700'}`}>
              {candidate.careerLevel}
            </span>
          </div>

          {/* Round-specific section */}
          {round === 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">Technical Match</p>
              <ScoreBar score={candidate.technicalScore} color="bg-blue-500" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {candidate.requiredSkillsFound.map(s => (
                  <span key={s} className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✓ {s}</span>
                ))}
                {candidate.requiredSkillsMissing.map(s => (
                  <span key={s} className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-600">✗ {s}</span>
                ))}
                {candidate.bonusSkills.slice(0, 3).map(s => (
                  <span key={s} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">{s}</span>
                ))}
              </div>
            </div>
          )}

          {round === 1 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500">Experience Level</p>
              <ScoreBar score={candidate.experienceScore} color="bg-violet-500" />
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-sm font-medium text-violet-900 leading-relaxed">
                  "{candidate.topAchievement}"
                </p>
              </div>
            </div>
          )}

          {round === 2 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">Overall Fit</p>
              <ScoreBar score={candidate.fitScore} color="bg-emerald-500" />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase">Technical</p>
                  <p className="text-lg font-black text-blue-700">{candidate.technicalScore}</p>
                </div>
                <div className="rounded-xl bg-violet-50 p-2.5">
                  <p className="text-[10px] font-semibold text-violet-500 uppercase">Experience</p>
                  <p className="text-lg font-black text-violet-700">{candidate.experienceScore}</p>
                </div>
              </div>
            </div>
          )}

          {/* Score breakdown — always visible */}
          {candidate.scoreBreakdown && (
            <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Why this score</p>
              <p className="text-xs text-zinc-600">{candidate.scoreBreakdown}</p>
            </div>
          )}

          {/* Pitch + concern */}
          <div className="border-t border-zinc-100 pt-3 space-y-1.5">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
              <span className="text-zinc-700 leading-snug">{candidate.advancePitch}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
              <span className="text-zinc-600 leading-snug">{candidate.concernFlag}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
