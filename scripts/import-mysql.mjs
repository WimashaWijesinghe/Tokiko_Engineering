import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
dotenv.config({path:'.env.local',quiet:true});
if(!process.env.DB_NAME || !process.env.DB_USER) throw new Error('Configure .env.local first');
const sql=readFileSync(process.argv[2] || 'database/mysql-import.sql','utf8');
const conn=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME,multipleStatements:true,charset:'utf8mb4'});
try {
 const [tables]=await conn.query('SHOW TABLES');
 if(tables.length) throw new Error('Import refused: target database must be empty. Use a new database, never overwrite the live database.');
 await conn.query(sql);
 console.log('Import complete. Run npm run db:compare before first use.');
} catch(error) {await conn.rollback().catch(()=>{});console.error('Import failed. DDL cannot be rolled back: inspect this new database and retry into another empty database.');throw error;}
finally {await conn.end();}
