function cleanUnique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const value = String(item).trim().replace(/\s+/g, " ");
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return value;
  });
}

function extractTopics(content) {
  const headings = String(content).match(/(?:^|\n)\s*(?:#{1,6}\s*)?([A-Z][A-Za-z0-9 &/-]{2,49})\s*(?::|\n)/gm) || [];
  return cleanUnique(headings.map((item) => item.replace(/^[\n#\s]+/, "").replace(/[:\n].*$/, "").trim())).slice(0, 8);
}

function extractDefinitions(content) {
  const definitions = [];
  const pattern = /(?:^|\n)\s*([A-Za-z][A-Za-z0-9 -]{1,49})\s+(?:is|means)\s+([^.\n]+)/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    definitions.push({ term: match[1].trim(), definition: match[2].trim() });
  }
  return definitions.slice(0, 10);
}

function extractKeywords(content) {
  const stop = new Set(["about","after","again","because","been","before","being","could","from","have","into","more","only","other","should","their","there","these","they","this","through","using","where","which","while","with","would","your"]);
  const counts = new Map();
  for (const raw of String(content).toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || []) {
    if (!stop.has(raw)) counts.set(raw, (counts.get(raw) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([term]) => term).slice(0, 12);
}

module.exports = { extractTopics, extractDefinitions, extractKeywords, cleanUnique };
