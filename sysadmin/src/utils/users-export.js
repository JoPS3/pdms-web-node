function escapeCsvCell(value) {
  const raw = String(value ?? '');
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function createCsv(rows) {
  const header = ['Utilizador', 'Nome', 'Email', 'Perfil', 'Autorizado'];
  const lines = [header.map(escapeCsvCell).join(',')];

  rows.forEach((row) => {
    const values = [
      row.userName || '',
      row.fullName || '',
      row.email || '',
      row.role || '',
      row.isAuthorized ? 'Sim' : 'Nao'
    ];
    lines.push(values.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createFlatOdf(rows) {
  const header = ['Utilizador', 'Nome', 'Email', 'Perfil', 'Autorizado'];
  const allRows = [header].concat(
    rows.map((row) => [
      row.userName || '',
      row.fullName || '',
      row.email || '',
      row.role || '',
      row.isAuthorized ? 'Sim' : 'Nao'
    ])
  );

  const xmlRows = allRows.map((cols) => {
    const xmlCols = cols.map((cell) => (
      `<table:table-cell office:value-type="string"><text:p>${escapeXml(cell)}</text:p></table:table-cell>`
    )).join('');
    return `<table:table-row>${xmlCols}</table:table-row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2"
  office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Utilizadores">
        ${xmlRows}
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document>`;
}

module.exports = { createCsv, createFlatOdf };
