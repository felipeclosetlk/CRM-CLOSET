import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';

const doc = new jsPDF();
doc.setFontSize(20);
doc.text('CRM - GESTÃO DE CLIENTES', 35, 20);

autoTable(doc, {
  head: [['Nome', 'Telefone', 'Tam', 'Cidade', 'Interesse', 'Canal', 'Status', 'Data']],
  body: [
    ['Joao Silva', '11999999999', 'M', 'SP', 'Camisa', 'WhatsApp', 'Sim', '06/07/2026'],
    ['Maria Souza', '11888888888', 'G', 'RJ', 'Calça', 'Instagram', 'Não', '05/07/2026']
  ],
  startY: 35,
});

fs.writeFileSync('test.pdf', Buffer.from(doc.output('arraybuffer')));
