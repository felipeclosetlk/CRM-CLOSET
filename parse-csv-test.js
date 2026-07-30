const text = '\uFEFFNome;Telefone\r\n"Teste";"123"';
const cleanText = text.replace(/^\uFEFF/, '');
const lines = cleanText.split(/\r?\n/);
const separator = lines[0].includes(';') ? ';' : ',';
const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
console.log(headers);
