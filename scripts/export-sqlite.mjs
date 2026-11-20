// Offline migration: Node.js 22.13+; no MySQL access or source writes.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const source = resolve(process.argv[2] || 'migration/source/pos_database.sqlite');
const output = resolve(process.argv[3] || 'database/mysql-import.sql');
if (source === output || existsSync(output)) throw new Error('Output already exists or is the source. Choose a new output filename.');
const db = new DatabaseSync(source, { readOnly: true });
const integrity = db.prepare('PRAGMA integrity_check').all();
if (integrity.some(row => Object.values(row)[0] !== 'ok')) throw new Error('SQLite integrity check failed');
const tables = JSON.parse(readFileSync(new URL('../migration/tables.json', import.meta.url), 'utf8'));
let schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
const actualTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name).sort();
if (JSON.stringify(actualTables) !== JSON.stringify(tables.map(t => t.name).sort())) throw new Error('Unexpected source tables. Stop and review; no tables silently omitted.');
const sequences = db.prepare('SELECT name, seq FROM sqlite_sequence').all();
for (const {name, seq} of sequences) {
  if (!Number.isSafeInteger(seq) || seq < 0) throw new Error('Invalid SQLite sequence');
  schema = schema.replace(new RegExp('(CREATE TABLE `'+name+'` \\([\\s\\S]*?\\) ENGINE=InnoDB)(?![A-Z])'), '$1 AUTO_INCREMENT='+String(seq+1));
}
const statements = [schema, '\nSTART TRANSACTION;'];
const report = { source, sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), tables: {}, integrity: 'ok' };
function literal(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Non-finite SQLite value'); return String(value); }
  // Hex UTF-8 avoids SQL-mode dependent escaping and preserves Unicode/newlines.
  return `CONVERT(0x${Buffer.from(String(value), 'utf8').toString('hex') || ''} USING utf8mb4)`.replace('0x USING', "'' USING");
}
db.exec('BEGIN');
try {
  for (const table of tables) {
    const actualColumns = db.prepare(`PRAGMA table_info(\`${table.name}\`)`).all().map(r => r.name);
    if (JSON.stringify(actualColumns) !== JSON.stringify(table.columns)) throw new Error(`Unexpected source schema: ${table.name}. Stop and review; no data omitted.`);
    const rows = db.prepare(`SELECT * FROM \`${table.name}\``).all();
    report.tables[table.name] = rows.length;
    for (const row of rows) statements.push(`INSERT INTO \`${table.name}\` (${table.columns.map(c => '`'+c+'`').join(',')}) VALUES (${table.columns.map(c => literal(row[c])).join(',')});`);
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; } finally { db.close(); }
statements.push('COMMIT;');
writeFileSync(output, statements.join('\n'), {flag:'wx'});
writeFileSync(output+'.report.json', JSON.stringify(report, null, 2), {flag:'wx'});
console.log(JSON.stringify(report, null, 2));
