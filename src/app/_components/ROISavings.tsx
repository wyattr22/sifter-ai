const RECRUITER_HOURLY = 35;
const MINUTES_PER_RESUME = 3;
const COST_PER_RESUME = (MINUTES_PER_RESUME / 60) * RECRUITER_HOURLY;

export function ROISavings({ count = 1 }: { count?: number }) {
  const savedMin = count * MINUTES_PER_RESUME;
  const savedDollars = count * COST_PER_RESUME;
  const at200 = 200 * COST_PER_RESUME;
  const hoursAt200 = (200 * MINUTES_PER_RESUME) / 60;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
        Time &amp; Cost Savings
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-amber-900">{savedMin} min</span>
        <span className="text-lg font-semibold text-amber-700">= ${savedDollars.toFixed(2)} saved</span>
      </div>
      <p className="mt-1 text-sm text-amber-800">
        At a $35/hr recruiter salary · {count} resume{count !== 1 ? 's' : ''} screened
      </p>
      <div className="mt-4 border-t border-amber-200 pt-4">
        <p className="text-sm font-medium text-amber-900">
          At 200 resumes per role:{' '}
          <span className="font-black">${at200.toFixed(0)} saved</span> and{' '}
          <span className="font-black">{hoursAt200.toFixed(0)} hours</span> back
        </p>
        <p className="mt-1 text-xs text-amber-700">
          That&apos;s an entire work day returned to your team — per open role.
        </p>
      </div>
    </div>
  );
}
