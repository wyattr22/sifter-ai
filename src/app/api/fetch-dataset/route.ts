export const runtime = 'nodejs';

const HF_BASE = 'https://datasets-server.huggingface.co';

interface DatasetConfig {
  id: string;
  resumeCol: string;
  roleCol: string | null;
  jdCol: string | null;
  supportsFilter: boolean;
  size: number;
  // If the role column stores encoded strings (e.g. "Generate a Resume for a X Job"), extract the role from it
  roleExtractor?: (raw: string) => string;
}

const DATASETS: DatasetConfig[] = [
  {
    id: 'AzharAli05/Resume-Screening-Dataset',
    resumeCol: 'Resume',
    roleCol: 'Role',
    jdCol: 'Job_Description',
    supportsFilter: true,
    size: 10174,
  },
  {
    id: 'InferencePrince555/Resume-Dataset',
    resumeCol: 'Resume_test',
    roleCol: 'instruction',
    jdCol: null,
    supportsFilter: false,
    size: 32481,
    // instruction = "Generate a Resume for a Software Engineer Job"
    roleExtractor: (raw: string) =>
      raw.replace(/^Generate a Resume for an? /i, '').replace(/ Job$/i, '').trim(),
  },
  {
    id: 'ahmedheakl/resume-atlas',
    resumeCol: 'Text',
    roleCol: 'Category',
    jdCol: null,
    supportsFilter: false,
    size: 13389,
  },
  {
    id: 'cnamuangtoun/resume-job-description-fit',
    resumeCol: 'resume_text',
    roleCol: null,
    jdCol: 'job_description_text',
    supportsFilter: false,
    size: 6241,
  },
  {
    id: 'opensporks/resumes',
    resumeCol: 'Resume_str',
    roleCol: 'Category',
    jdCol: null,
    supportsFilter: false,
    size: 2484,
  },
];

const TOTAL_RESUMES = DATASETS.reduce((s, d) => s + d.size, 0); // ~64,769

interface HFRow {
  row_idx: number;
  row: Record<string, string>;
}

function hfFetch(path: string): Promise<Response> {
  return fetch(`${HF_BASE}${path}`, { headers: { 'User-Agent': 'Sifter-App/1.0' } });
}

async function filterPage(
  datasetId: string,
  where: string,
  offset: number,
  length: number,
): Promise<{ rows: HFRow[]; total: number | null }> {
  try {
    const res = await hfFetch(
      `/filter?dataset=${encodeURIComponent(datasetId)}&config=default&split=train&where=${where}&offset=${offset}&length=${length}`,
    );
    if (!res.ok) return { rows: [], total: null };
    const d = await res.json();
    return { rows: d.rows ?? [], total: d.num_rows_total ?? null };
  } catch {
    return { rows: [], total: null };
  }
}

function roleMatches(ds: DatasetConfig, row: HFRow, query: string): boolean {
  if (!ds.roleCol) return true; // no role col → accept all
  const raw = row.row[ds.roleCol] ?? '';
  const normalized = (ds.roleExtractor ? ds.roleExtractor(raw) : raw).toLowerCase();
  const q = query.toLowerCase();
  // Direct containment either direction
  if (normalized.includes(q) || q.includes(normalized)) return true;
  // Stem match: each significant query word (first 5 chars) appears in normalized
  // Handles "Data Scientist" matching "DATA SCIENCE", "Software Eng" matching "SOFTWARE ENGINEER" etc.
  return q.split(/\s+/)
    .filter(w => w.length >= 4)
    .every(w => normalized.includes(w.slice(0, 5)));
}

async function scanPages(ds: DatasetConfig, role: string, pages: number): Promise<HFRow[]> {
  const maxOffset = Math.max(0, ds.size - 100);
  const offsets = Array.from({ length: pages }, () => Math.floor(Math.random() * maxOffset));
  // Fetch 2 at a time to avoid hammering HuggingFace rate limits
  const results: HFRow[] = [];
  for (let i = 0; i < offsets.length; i += 2) {
    const chunk = offsets.slice(i, i + 2);
    const rows = await Promise.all(
      chunk.map(offset =>
        hfFetch(
          `/rows?dataset=${encodeURIComponent(ds.id)}&config=default&split=train&offset=${offset}&length=100`,
        )
          .then(r => r.json())
          .then(d => (d.rows ?? []) as HFRow[])
          .catch(() => [] as HFRow[]),
      ),
    );
    results.push(...rows.flat().filter(r => roleMatches(ds, r, role)));
    if (results.length >= 30) break; // stop early once we have enough
  }
  return results;
}

interface DatasetResult {
  rows: HFRow[];
  roleTotal: number | null;
  jd: string | null;
  ds: DatasetConfig;
}

async function fetchFromDataset(ds: DatasetConfig, role: string, count: number): Promise<DatasetResult> {
  let rows: HFRow[] = [];
  let roleTotal: number | null = null;

  if (ds.supportsFilter && ds.roleCol) {
    const where = encodeURIComponent(`${ds.roleCol} LIKE '%${role}%'`);
    if (count <= 100) {
      const r = await filterPage(ds.id, where, 0, count);
      rows = r.rows;
      roleTotal = r.total;
    } else {
      const [p1, p2] = await Promise.all([
        filterPage(ds.id, where, 0, 100),
        filterPage(ds.id, where, 100, 100),
      ]);
      rows = [...p1.rows, ...p2.rows];
      roleTotal = p1.total ?? p2.total;
    }
  }

  if (rows.length === 0) {
    const pages = ds.size > 20000 ? 6 : 4;
    rows = await scanPages(ds, role, pages);
    roleTotal = (roleTotal ?? 0) + rows.length;
  }

  const jd = ds.jdCol
    ? (rows.map(r => r.row[ds.jdCol!]).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? null)
    : null;

  return { rows, roleTotal, jd, ds };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(parseInt(searchParams.get('count') ?? '50'), 200);
  const role = searchParams.get('role') ?? null;

  try {
    if (!role) {
      // Initial load: sample categories from the two most role-diverse datasets
      const [primary, secondary] = await Promise.all([
        hfFetch(
          `/rows?dataset=${encodeURIComponent(DATASETS[0].id)}&config=default&split=train&offset=0&length=100`,
        ).then(r => r.json()).catch(() => ({ rows: [] })),
        hfFetch(
          `/rows?dataset=${encodeURIComponent(DATASETS[1].id)}&config=default&split=train&offset=0&length=100`,
        ).then(r => r.json()).catch(() => ({ rows: [] })),
      ]);

      const catCounts: Record<string, number> = {};
      for (const row of (primary.rows ?? []) as HFRow[]) {
        const c = row.row[DATASETS[0].roleCol!];
        if (c) catCounts[c] = (catCounts[c] ?? 0) + 1;
      }
      for (const row of (secondary.rows ?? []) as HFRow[]) {
        const ds = DATASETS[1];
        const raw = row.row[ds.roleCol!] ?? '';
        const c = ds.roleExtractor ? ds.roleExtractor(raw) : raw;
        if (c) catCounts[c] = (catCounts[c] ?? 0) + 1;
      }

      return Response.json({
        resumes: [],
        jobDescription: null,
        total: TOTAL_RESUMES,
        fetched: 0,
        roleTotal: null,
        dataset: 'multi',
        categories: Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([r, c]) => ({ role: r, count: c })),
      });
    }

    // Fan out to all datasets in parallel
    const perDs = Math.min(Math.ceil(count / DATASETS.length) + 40, 150);
    const results = await Promise.all(DATASETS.map(ds => fetchFromDataset(ds, role, perDs)));

    // Merge + deduplicate by first 100 chars
    const seen = new Set<string>();
    const merged: string[] = [];
    let jobDescription: string | null = null;
    let roleTotal = 0;
    const catCounts: Record<string, number> = {};

    for (const { rows, roleTotal: rt, jd, ds } of results) {
      if (jd && (!jobDescription || jd.length > jobDescription.length)) jobDescription = jd;
      if (rt) roleTotal += rt;

      for (const row of rows) {
        const text = row.row[ds.resumeCol] ?? '';
        const key = text.slice(0, 100);
        if (text.length > 100 && !seen.has(key)) {
          seen.add(key);
          merged.push(text);
        }
        if (ds.roleCol) {
          const raw = row.row[ds.roleCol] ?? '';
          const c = ds.roleExtractor ? ds.roleExtractor(raw) : raw;
          if (c) catCounts[c] = (catCounts[c] ?? 0) + 1;
        }
      }
    }

    const resumes = merged.slice(0, count);

    return Response.json({
      resumes,
      jobDescription,
      total: TOTAL_RESUMES,
      fetched: resumes.length,
      roleTotal: roleTotal || null,
      dataset: 'multi',
      categories: Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([r, c]) => ({ role: r, count: c })),
    });
  } catch (err) {
    console.error('HF fetch error:', err);
    return Response.json({ error: 'Failed to fetch from HuggingFace.' }, { status: 500 });
  }
}
