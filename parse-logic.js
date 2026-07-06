const items = [  'CRM - GESTÃO DE CLIENTES',  '',  'Nome',  ' ',  'Telefone',  ' ',  'Tam',  ' ',  'Cidade',  ' ',  'Interesse',  ' ',  'Canal',  ' ',  'Status',  ' ',  'Data',  '',  'Joao Silva',  ' ',  '11999999999',  ' ',  'M',  ' ',  'SP',  ' ',  'Camisa',  ' ',  'WhatsApp',  ' ',  'Sim',  ' ',  '06/07/2026',  'Maria Souza',  ' ',  '11888888888',  ' ',  'G',  ' ',  'RJ',  ' ',  'Calça',  ' ',  'Instagram',  ' ',  'Não',  ' ',  '05/07/2026'];

const filtered = items.map(i => i.trim()).filter(i => i.length > 0);
console.log('Filtered:', filtered);

const dataIndex = filtered.indexOf('Data');
const rows = [];
if (dataIndex !== -1) {
    const dataItems = filtered.slice(dataIndex + 1);
    for (let i = 0; i < dataItems.length; i += 8) {
        if (i + 7 < dataItems.length) {
            rows.push({
                nome: dataItems[i],
                telefone: dataItems[i+1],
                tamanho: dataItems[i+2],
                cidade: dataItems[i+3],
                interesse: dataItems[i+4],
                canal: dataItems[i+5],
                comprou_status: dataItems[i+6],
                data: dataItems[i+7]
            });
        }
    }
}
console.log(rows);
