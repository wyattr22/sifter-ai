export const runtime = 'nodejs';

const HF_BASE = 'https://datasets-server.huggingface.co';
const DATASET = 'AzharAli05/Resume-Screening-Dataset';

interface HFRow {
  row_idx: number;
  row: Record<string, string>;
}

function detectCol(features: { name: string }[], patterns: string[]): string | null {
  for (const p of patterns) {
    const f = features.find(f => f.name.toLowerCase().replace(/[^a-z_]/g, '').includes(p));
    if (f) return f.name;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(parseInt(searchParams.get('count') ?? '50'), 100);
  const role = searchParams.get('role') ?? null;

  try {
    // Get metadata (total + column schema)
    const metaRes = await fetch(
      `${HF_BASE}/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=0&length=1`,
      { headers: { 'User-Agent': 'Sift-App/1.0' } }
    );
    const meta = await metaRes.json();
    const total: number = meta.num_rows_total ?? 10174;
    const features: { name: string }[] = meta.features ?? [];

    const resumeCol = detectCol(features, ['resume', 'cv', 'text', 'content']) ?? 'Resume';
    const jdCol = detectCol(features, ['job_description', 'jd', 'description']);
    const roleCol = detectCol(features, ['role', 'category', 'job_title', 'position']);

    let rows: HFRow[] = [];
    let roleTotal: number | null = null;

    if (role && roleCol) {
      // Strategy 1: HuggingFace /filter endpoint (parquet SQL)
      let filterSucceeded = false;
      try {
        const where = encodeURIComponent(`${roleCol} LIKE '%${role}%'`);
        const filterRes = await fetch(
          `${HF_BASE}/filter?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&where=${where}&offset=0&length=${count}`,
          { headers: { 'User-Agent': 'Sift-App/1.0' } }
        );
        if (filterRes.ok) {
          const filterData = await filterRes.json();
          if (filterData.rows?.length > 0) {
            rows = filterData.rows;
            roleTotal = filterData.num_rows_total ?? null;
            filterSucceeded = true;
          }
        }
      } catch { /* filter not supported — fall through */ }

      // Strategy 2: Scan 4 random pages of 100 rows, filter locally
      if (!filterSucceeded) {
        const maxOffset = Math.max(0, total - 100);
        const offsets = Array.from({ length: 4 }, () => Math.floor(Math.random() * maxOffset));
        const batches = await Promise.all(
          offsets.map(offset =>
            fetch(
              `${HF_BASE}/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=100`,
              { headers: { 'User-Agent': 'Sift-App/1.0' } }
            )
              .then(r => r.json())
              .then(d => (d.rows ?? []) as HFRow[])
              .catch(() => [] as HFRow[])
          )
        );
        const allRows = batches.flat();
        const matched = allRows.filter(r =>
          r.row[roleCol]?.toLowerCase().includes(role.toLowerCase())
        );
        rows = matched.slice(0, count);
        roleTotal = matched.length;
      }
    } else {
      // Random sample for browsing / category discovery
      const maxOffset = Math.max(0, total - count);
      const offset = Math.floor(Math.random() * maxOffset);
      const rowsRes = await fetch(
        `${HF_BASE}/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=${count}`,
        { headers: { 'User-Agent': 'Sift-App/1.0' } }
      );
      const rowsData = await rowsRes.json();
      rows = rowsData.rows ?? [];
    }

    const resumes = rows.map(r => r.row[resumeCol]).filter(s => s && s.length > 100);

    // Pick the best (longest) job description from matched rows
    let jobDescription: string | null = null;
    if (jdCol) {
      const jds = rows.map(r => r.row[jdCol]).filter(Boolean);
      jobDescription = jds.sort((a, b) => b.length - a.length)[0] ?? null;
    }

    // Category breakdown
    const categories: Record<string, number> = {};
    if (roleCol) {
      rows.forEach(r => {
        const c = r.row[roleCol];
        if (c) categories[c] = (categories[c] ?? 0) + 1;
      });
    }

    return Response.json({
      resumes,
      jobDescription,
      total,
      fetched: resumes.length,
      roleTotal,
      dataset: DATASET,
      categories: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([role, count]) => ({ role, count })),
    });
  } catch (err) {
    console.error('HF fetch error:', err);
    return Response.json({ error: 'Failed to fetch from HuggingFace.' }, { status: 500 });
  }
}
