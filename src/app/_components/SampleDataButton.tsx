'use client';

const SAMPLE_JD = `Senior Backend Engineer — Python/Django

We're looking for an experienced backend engineer to join our platform team.

Requirements:
- 5+ years of professional Python experience
- 3+ years with Django or FastAPI in production
- PostgreSQL — schema design, query optimization, migrations
- REST API design and implementation
- Experience with high-traffic production systems (>100k requests/day)
- AWS (EC2, RDS, S3, Lambda)

Nice to have:
- Redis for caching and queuing
- Celery for async task processing
- Docker and container orchestration
- Experience with data pipelines`;

const SAMPLE_RESUME = `Jane Smith
jane.smith@email.com | github.com/janesmith

EXPERIENCE

Software Engineer — AcmeCorp (4 years, 2020–2024)
- Built and maintained REST APIs serving 50,000 requests/day using Python and Flask
- Designed MySQL database schemas for a multi-tenant SaaS product
- Deployed and maintained services using Docker on AWS EC2
- Integrated third-party payment and identity APIs

Junior Developer — StartupXYZ (2 years, 2018–2020)
- Built backend features in PHP/Laravel
- Worked with small Postgres databases for internal tools

SKILLS
Languages: Python (4 years), PHP (2 years), JavaScript
Frameworks: Flask, Laravel
Databases: MySQL, basic PostgreSQL
DevOps: Docker, Git, AWS EC2/S3
Other: REST APIs, agile/scrum

EDUCATION
B.S. Computer Science — State University, 2018`;

export function SampleDataButton({
  onLoad,
}: {
  onLoad: (jd: string, resume: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onLoad(SAMPLE_JD, SAMPLE_RESUME)}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
    >
      Load Sample Data
    </button>
  );
}
