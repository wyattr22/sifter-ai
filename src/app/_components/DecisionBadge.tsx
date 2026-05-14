import type { Screening } from '@/lib/screening-schema';

const config = {
  ADVANCE: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: '✓',
    label: 'ADVANCE',
  },
  HOLD: {
    color: 'text-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    icon: '?',
    label: 'HOLD',
  },
  REJECT: {
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    icon: '✗',
    label: 'REJECT',
  },
};

export function DecisionBadge({ decision, topReason }: Pick<Screening, 'decision' | 'topReason'>) {
  const c = config[decision];
  return (
    <div className={`rounded-2xl border-2 p-6 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <span className={`text-6xl font-black tracking-tight ${c.color}`}>{c.label}</span>
        <span className={`text-4xl font-bold ${c.color}`}>{c.icon}</span>
      </div>
      <p className="mt-2 text-base font-medium text-zinc-700">{topReason}</p>
    </div>
  );
}
