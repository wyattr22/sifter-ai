'use client';

export function FitScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference * 0.75; // 270deg arc
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Fit Score</p>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Background arc */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke="#e4e4e7" strokeWidth="12"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
        />
        {/* Score arc */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="70" y="70" textAnchor="middle" dy="0.4em" fontSize="32" fontWeight="900" fill={color}>
          {score}
        </text>
        <text x="70" y="92" textAnchor="middle" fontSize="11" fill="#71717a" fontWeight="600">
          / 100
        </text>
      </svg>
    </div>
  );
}
