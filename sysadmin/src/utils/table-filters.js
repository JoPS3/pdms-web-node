/**
 * Parses table filter query params (tf*) into a structured object.
 * e.g. ?tfUserName=alice&tfRole=ADMIN → { userName: ['alice'], role: ['ADMIN'] }
 */
function parseTableFiltersFromQuery(query) {
  const tableFilters = {};
  const tfPattern = /^tf([A-Z][a-zA-Z]*)$/;
  for (const [key, value] of Object.entries(query || {})) {
    const match = key.match(tfPattern);
    if (match) {
      const filterKey = match[1][0].toLowerCase() + match[1].slice(1);
      tableFilters[filterKey] = Array.isArray(value) ? value : [value];
    }
  }
  return tableFilters;
}

module.exports = { parseTableFiltersFromQuery };
