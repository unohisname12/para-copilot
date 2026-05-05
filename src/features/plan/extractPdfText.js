import * as pdfjsLib from 'pdfjs-dist';
import { configurePdfWorker } from '../../utils/pdfWorker';

configurePdfWorker(pdfjsLib);

// Pull plain text out of a PDF file the para uploaded for today's plan.
// Uses the same y-coordinate line-rebuild trick the roster importer uses
// so the result preserves reading order even with multi-column pages.
export async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = {};
    content.items.forEach(it => {
      const y = Math.round((it.transform?.[5] ?? 0));
      if (!byY[y]) byY[y] = [];
      byY[y].push(it.str);
    });
    const ys = Object.keys(byY).map(Number).sort((a, b) => b - a);
    ys.forEach(y => { text += byY[y].join(' ') + '\n'; });
    text += '\n';
  }
  return text.trim();
}
