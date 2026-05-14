import { extractText, getDocumentProxy } from 'unpdf';

export const runtime = 'nodejs';

async function pdfToText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return Response.json({ error: 'No files provided.' }, { status: 400 });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const name = file.name;

        if (name.endsWith('.pdf')) {
          const text = await pdfToText(buffer);
          return { name, text, ok: true };
        }

        if (name.endsWith('.txt')) {
          return { name, text: buffer.toString('utf-8').trim(), ok: true };
        }

        return { name, text: '', ok: false, error: 'Unsupported type — upload PDF or TXT' };
      })
    );

    return Response.json({ files: results });
  } catch (err) {
    console.error('Parse error:', err);
    return Response.json({ error: 'Failed to parse files.' }, { status: 500 });
  }
}
