import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const doc = new jsPDF();
autoTable(doc, {
  head: [['Nome', 'Telefone', 'Tam', 'Cidade', 'Interesse', 'Canal', 'Status', 'Data']],
  body: [
    ['Manoela', '6799822203', 'P', 'CAMPO\nGRANDE/MS', 'Calça Formal', 'Loja\nFísica', 'Não', '20/06/2026']
  ],
});
fs.writeFileSync('test_wrap.pdf', Buffer.from(doc.output('arraybuffer')));

async function parse() {
  const dataBuffer = new Uint8Array(fs.readFileSync('test_wrap.pdf'));
  const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  
  const items = textContent.items.map(item => ({
    str: item.str,
    x: item.transform[4],
    y: item.transform[5]
  }));
  
  console.log(items.filter(i => i.str.trim() !== ''));
}

parse().catch(console.error);
