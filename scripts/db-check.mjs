import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
dotenv.config({path:'.env.local', quiet:true});
const connection = await mysql.createConnection({host:process.env.DB_HOST || '127.0.0.1', port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD || '',database:process.env.DB_NAME, dateStrings:true,decimalNumbers:true});
try {
  console.log((await connection.query('SELECT VERSION() AS version'))[0]);
  const tables=JSON.parse(readFileSync(new URL('../migration/tables.json',import.meta.url),'utf8'));
  if(process.argv.includes('--compare-source')) {
    const source=process.argv.find(x=>x.startsWith('--source='))?.slice(9) || 'migration/source/pos_database.sqlite';
    const db=new DatabaseSync(source,{readOnly:true});
    try {
      for(const table of tables) {
        const order=table.name==='settings'?'key':'id';
        const rows=db.prepare(`SELECT * FROM \`${table.name}\` ORDER BY \`${order}\``).all();
        const [migrated]=await connection.query(`SELECT * FROM \`${table.name}\` ORDER BY \`${order}\``);
        // Compare by identity rather than collation-dependent ordering.
        const byId=new Map(migrated.map(r=>[String(r[order]),r]));
        assert.equal(migrated.length,rows.length,`${table.name}: row count`);
        for(const row of rows) {const other=byId.get(String(row[order]));assert.ok(other);for(const col of table.columns) assert.deepEqual(other[col],row[col],`${table.name}.${row[order]}.${col}`);}
        console.log(`${table.name}: ${rows.length} rows, every column matches`);
      }
    } finally {db.close();}
  } else {
    for(const table of tables) console.log(table.name,(await connection.query(`SELECT COUNT(*) AS count FROM \`${table.name}\``))[0][0].count);
  }
  const [lock] = await connection.query('SELECT id FROM pos_write_lock WHERE id=1');
  assert.equal(lock.length,1,'Missing write lock row');
  console.log('Database checks passed.');
} finally {await connection.end();}
