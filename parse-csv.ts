export const exportToCSV = (clients: any[]) => {
  const headers = ['Nome', 'Telefone', 'Tamanho', 'Cidade', 'Interesse', 'Canal', 'Status', 'Observacoes', 'Data'];
  const rows = clients.map(c => [
    `"${c.nome || ''}"`,
    `"${c.telefone || ''}"`,
    `"${c.tamanho || ''}"`,
    `"${c.cidade || ''}"`,
    `"${c.comprou || ''}"`,
    `"${c.canal || ''}"`,
    `"${c.comprou_status || ''}"`,
    `"${(c.obs || '').replace(/"/g, '""')}"`,
    `"${new Date().toLocaleDateString('pt-BR')}"`
  ]);
  const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
  return csvContent;
}

export const parseCSV = (csvContent: string) => {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';');
  return lines.slice(1).map(line => {
    // Basic CSV splitting that respects quotes
    let row = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ';' && !inQuotes) {
            row.push(current);
            current = '';
        } else {
            current += line[i];
        }
    }
    row.push(current);
    
    return headers.reduce((acc, header, i) => {
        acc[header.replace(/"/g, '').trim()] = row[i]?.replace(/"/g, '').trim() || '';
        return acc;
    }, {} as Record<string, string>);
  });
}
