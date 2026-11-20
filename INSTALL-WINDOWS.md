# Simple POS — Windows + XAMPP installation

Frontend: unchanged Next.js/React/TypeScript/Tailwind. Backend: Next.js Node API routes. Database: MySQL/MariaDB through mysql2. XAMPP provides MariaDB (the control-panel button is labelled MySQL); Next.js still runs with Node, not PHP/Apache.

## 1. Requirements and extract

- Install Node.js 22.13 or newer (Node 24 was used for validation), with npm.
- Install XAMPP for Windows. Start **MySQL**. Start **Apache** if using phpMyAdmin.
- Extract this entire folder to `C:\POS\simple-pos-mysql`. Do not copy `node_modules` or `.next` from the old SQLite project.
- This is a local-PC setup: the application binds to `127.0.0.1`, port 4500. There is no login/role system in the original project; this conversion does not add one. Keep it local.

## 2. Create a NEW database and import the existing data

Keep the original ZIP and old SQLite project untouched. Do not import into any hotel, distribution, or other existing database.

Open `http://localhost/phpmyadmin` and use the SQL tab:

```sql
CREATE DATABASE simple_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Select **simple_pos** in the left panel, choose **Import**, and select `database\mysql-import.sql`. This single file contains both schema and all data from the uploaded project. Do NOT also import `schema.sql`; it is provided as the schema reference only.

The import intentionally has no DROP/TRUNCATE/REPLACE statements and requires empty tables. If an import fails, stop, inspect the error, and retry in another NEW empty database. MySQL schema creation is not transactionally reversible; never continue a failed import with “ignore errors”.

Alternative from Windows CMD (if your XAMPP root account has an empty password, press Enter at the password prompt):

```bat
cd /d C:\POS\simple-pos-mysql
C:\xampp\mysql\bin\mysql.exe -u root -p simple_pos < database\mysql-import.sql
```

Create an application account through phpMyAdmin's SQL tab; replace the password below with your own:

```sql
CREATE USER 'simple_pos_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_YOUR_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON simple_pos.* TO 'simple_pos_app'@'127.0.0.1';
```

The application never creates tables or inserts sample data automatically. Use this account rather than the XAMPP root account at runtime.

## 3. Configure and install

In CMD:

```bat
cd /d C:\POS\simple-pos-mysql
copy .env.example .env.local
notepad .env.local
```

Set the same database name, username, password and XAMPP MySQL port:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=simple_pos
DB_USER=simple_pos_app
DB_PASSWORD=YOUR_ACTUAL_PASSWORD
```

Use double quotes around a password containing `#` or spaces. Never put DB credentials in a `NEXT_PUBLIC_` variable. Restart Node after changing the file.

```bat
npm ci
npm run db:compare
npm run build
npm start
```

`db:compare` must pass BEFORE entering new transactions. It compares every original column in every row to the supplied SQLite snapshot. After you begin live work, differences are expected; use `npm run db:check` for connection/table checks instead.

Open `http://localhost:4500`. The terminal must stay open. On later days, start XAMPP MySQL and run `start-pos.bat`. Run `npm run build` again after code changes. `npm run dev` is available for development.

## 4. If your old PC has NEWER SQLite transactions

The included SQL reflects the uploaded ZIP, not subsequent work on your PC. Do not use it to overwrite newer records.

1. Close the old POS server and all processes using SQLite.
2. Back up the entire old folder, including `pos_database.sqlite` and any `-wal`/`-shm` companion files. Do not copy only the main SQLite file while the app is running.
3. Generate a NEW SQL filename from the latest stopped database:

```bat
node scripts\export-sqlite.mjs "C:\OLD-POS\pos_database.sqlite" "database\latest-import.sql"
```

The exporter reads SQLite only, checks integrity and the exact table/column layout, preserves IDs, SQLite ID sequences, text/Unicode, NULL values and timestamps, and refuses to overwrite its output. Unexpected schema changes stop migration rather than silently dropping columns/tables.

4. Import `latest-import.sql` into a NEW empty database, then update `.env.local`.
5. Compare to that same source before first use:

```bat
node scripts\db-check.mjs --compare-source "--source=C:\OLD-POS\pos_database.sqlite"
```

SQLite is used only by these offline migration/check scripts. The running POS uses MySQL exclusively. No live dual-write or automatic merging is included.

An optional `npm run db:import -- database\latest-import.sql` importer refuses a nonempty target database. It requires a temporary migration account with CREATE/INDEX/REFERENCES permissions in addition to DML; the normal app account above deliberately has no schema permissions. Prefer phpMyAdmin for initial import, and keep the app account for runtime.

## 5. Backup and recovery

Stop POS writes before backups when practical. In CMD, create a dated backup; change the filename for every backup:

```bat
mkdir C:\POS-Backups
C:\xampp\mysql\bin\mysqldump.exe -h 127.0.0.1 -P 3306 -u simple_pos_app -p --single-transaction --skip-lock-tables --no-tablespaces simple_pos > C:\POS-Backups\simple-pos-2026-11-12.sql
```

Check the command succeeded and the file is not empty. Restore into a different NEW database using phpMyAdmin or `mysql.exe`, point a stopped POS copy at it, then check settings, totals, stock, invoices and serials. Keep a second backup off the PC. Automatic backups and a Windows restore drill are not configured by this ZIP.

Before accepting new MySQL transactions, rollback means stopping the new server and returning to the untouched old SQLite project. After live MySQL transactions exist, reverting to the old SQLite snapshot would lose those transactions; reconcile/export newer work first. No automated reverse migration is included.

## 6. Troubleshooting

- **ECONNREFUSED:** Start XAMPP MySQL and check its port against DB_PORT. Apache alone does not start the database.
- **Access denied:** Check account host (`127.0.0.1`), password, database permissions, and restart Node.
- **Unknown database/table:** Confirm the full import succeeded in the database named in `.env.local`.
- **node:sqlite unavailable:** Use Node >=22.13 for the exporter/comparison scripts. Runtime API code does not import SQLite.
- **Port 4500 in use:** Run `netstat -ano | findstr :4500`, identify the process, and close your existing POS terminal. Do not kill an unknown process.
- **Power loss/failed request:** The transaction rolls back uncommitted changes. If the browser lost the response after commit, inspect the invoice list before retrying; request-id based deduplication was not added.
- **Printer:** The existing browser print/PDF interface is unchanged. Select the Windows printer in its print dialog. Saving `printer_name` does not install a driver or implement silent printing. Physical print and PDF visual QA remain local acceptance checks.

## 7. Acceptance before real use

See `VALIDATION.md` for executed checks and limitations. On your Windows PC, confirm existing records, create a test GRN, quotation, partial invoice, follow-up payment, warranty search, PDF and print; check stock and restore a backup into a separate database. Do not run `test:core` on live data: it deliberately writes fixtures and is guarded for disposable test databases.

Official references: https://www.apachefriends.org/faq_windows.html and https://sidorares.github.io/node-mysql2/docs/documentation/promise-wrapper .
