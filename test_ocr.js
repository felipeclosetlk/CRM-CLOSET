const fs = require('fs');

const items = [
  { str: 'Nome', x: 45, y: 788 },
  { str: 'Telefone', x: 104, y: 788 },
  { str: 'Tam', x: 183, y: 788 },
  { str: 'Andreia', x: 45, y: 766 },
  { str: '67999723051', x: 104, y: 766 },
  { str: 'P', x: 183, y: 766 }
];

let parsedRows = [];
let currentRowData = {};
let lastColIndex = -1;

const headerY = items.find(i => i.str === 'Nome')?.y;
const rawHeaders = items.filter(i => Math.abs(i.y - headerY) < 2);
const cols = rawHeaders
.map(h => ({ name: h.str, x: h.x }))
.sort((a, b) => a.x - b.x)
.map((col, index, array) => ({
    ...col,
    endX: index < array.length - 1 ? array[index + 1].x - 2 : Infinity
}));

const dataItems = items.filter(i => i.y < headerY - 5 && i.str.trim().length > 0);

for (const item of dataItems) {
    const colIndex = cols.findIndex(c => item.x >= c.x - 5 && item.x <= c.endX);
    if (colIndex === -1) continue;
    
    if (colIndex <= lastColIndex) { // CHANGED THIS TO <= BECAUSE SOMETIMES PDFJS SPLITS TEXT IN THE SAME COLUMN! No wait, if they are in the same column, it shouldn't trigger a new row UNLESS the Y is different!
        // wait!
    }
}
