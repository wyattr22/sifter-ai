import type { Screening } from '@/lib/screening-schema';

export function StrengthsGaps({ strengths, gaps }: Pick<Screening, 'strengths' | 'gaps'>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Strengths
        </h3>
        <ul className="space-y-2">
          {strengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
              <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-red-700">
          Gaps
        </h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-emerald-600">No significant gaps identified.</p>
        ) : (
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-0.5 shrink-0 text-red-500">✗</span>
                {g}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
