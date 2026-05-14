import { ScreenerForm } from './_components/ScreenerForm';

export default function Home() {
  return (
    <main>
      {/* Dark hero header */}
      <section className="bg-zinc-950 px-6 py-14 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          AI-Powered Hiring
        </p>
        <h1 className="text-5xl font-black tracking-tight text-white">
          Job Screener AI
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Screen any resume in under 5 seconds. Built for recruiters, not engineers.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {[
            '3 min saved per resume',
            '$1.75 saved per screen',
            '$350 saved per 200-app role',
            '10 hours back per hire',
          ].map((stat) => (
            <span
              key={stat}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300"
            >
              {stat}
            </span>
          ))}
        </div>
      </section>

      {/* Light form section */}
      <section className="min-h-screen bg-zinc-50">
        <ScreenerForm />
      </section>
    </main>
  );
}
