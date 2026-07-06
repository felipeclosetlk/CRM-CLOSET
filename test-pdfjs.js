import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function parse() {
  const dataBuffer = new Uint8Array(fs.readFileSync('test.pdf'));
  const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items.map(item => item.str);
  console.log(items);
}

parse().catch(console.error);
