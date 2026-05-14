export const runtime = 'nodejs';

const HF_BASE = 'https://datasets-server.huggingface.co';

interface HFRow {
  row_idx: number;
  row: Record<string, string>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(parseInt(searchParams.get('count') ?? '50'), 100);
  const dataset = searchParams.get('dataset') ?? 'AzharAli05/Resume-Screening-Dataset';
  const role = searchParams.get('role') ?? null;

  try {
    // Get total rows
    const infoRes = await fetch(
      `${HF_BASE}/rows?dataset=${encodeURIComponent(dataset)}&config=default&split=train&offset=0&length=1`,
      { headers: { 'User-Agent': 'Sift-App/1.0' } }
    );
    const info = await infoRes.json();
    const total: number = info.num_rows_total ?? 10174;

    // Fetch from a random starting point for variety
    const maxOffset = Math.max(0, total - count);
    const offset = Math.floor(Math.random() * maxOffset);

    const rowsRes = await fetch(
      `${HF_BASE}/rows?dataset=${encodeURIComponent(dataset)}&config=default&split=train&offset=${offset}&length=${count}`,
      { headers: { 'User-Agent': 'Sift-App/1.0' } }
    );
    const rowsData = await rowsRes.json();
    const rows: HFRow[] = rowsData.rows ?? [];

    // Detect which column has the resume text
    const features: { name: string }[] = rowsData.features ?? [];
    const resumeCol = features.find(f =>
      ['resume', 'resume_str', 'cv', 'text', 'content'].some(p => f.name.toLowerCase().includes(p))
    )?.name ?? 'Resume';
    const jdCol = features.find(f =>
      ['job_description', 'job description', 'jd', 'description'].some(p => f.name.toLowerCase().includes(p))
    )?.name ?? null;
    const roleCol = features.find(f =>
      ['role', 'category', 'job_title', 'position'].some(p => f.name.toLowerCase().includes(p))
    )?.name ?? null;

    // Filter by role if requested
    let filtered = rows;
    if (role && roleCol) {
      filtered = rows.filter(r => r.row[roleCol]?.toLowerCase().includes(role.toLowerCase()));
    }

    const resumes = filtered.map(r => r.row[resumeCol]).filter(s => s && s.length > 100);

    // Grab a representative job description
    let jobDescription: string | null = null;
    if (jdCol) {
      const jds = filtered.map(r => r.row[jdCol]).filter(Boolean);
      jobDescription = jds[0] ?? null;
    }

    // Category breakdown
    const categories: Record<string, number> = {};
    if (roleCol) {
      filtered.forEach(r => {
        const c = r.row[roleCol];
        if (c) categories[c] = (categories[c] ?? 0) + 1;
      });
    }

    return Response.json({
      resumes,
      jobDescription,
      total,
      fetched: resumes.length,
      offset,
      dataset,
      categories: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([role, count]) => ({ role, count })),
    });
  } catch (err) {
    console.error('HF fetch error:', err);
    return Response.json({ error: 'Failed to fetch from HuggingFace.' }, { status: 500 });
  }
}
