import fs from "fs";

/**
 * Parse a Pi SDK session JSONL file into entries. Returns null when the file
 * cannot be losslessly rewritten.
 *
 * @param {string} raw
 * @returns {Array|null}
 */
export function parseSessionEntries(raw) {
  const entries = [];
  const lines = String(raw || "").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  if (entries.length === 0) return null;
  const header = entries[0];
  if (!header || header.type !== "session" || typeof header.id !== "string") {
    return null;
  }
  return entries;
}

/**
 * Serialize entries in the same line-oriented format SessionManager._rewriteFile
 * uses, including a single trailing newline.
 *
 * @param {Array} entries
 * @returns {string}
 */
export function serializeSessionEntries(entries) {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

/**
 * @param {string} sessionPath
 * @returns {{ raw: string, entries: Array } | null}
 */
export function readSessionEntriesFile(sessionPath) {
  let raw;
  try {
    raw = fs.readFileSync(sessionPath, "utf-8");
  } catch {
    return null;
  }

  const entries = parseSessionEntries(raw);
  if (!entries) return null;
  return { raw, entries };
}

/**
 * @param {string} sessionPath
 * @param {Array} entries
 */
export function writeSessionEntriesFile(sessionPath, entries) {
  fs.writeFileSync(sessionPath, serializeSessionEntries(entries));
}
