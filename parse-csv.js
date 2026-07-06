const exportToCSV = (clients) => {
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
    `"${new Date().toLocaleDateString()}"`
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
  console.log(csvContent.slice(0, 100));
}
exportToCSV([{nome: "Teste", telefone: "123"}]);
