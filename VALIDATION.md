# Conversion and validation record

## Scope

Reviewed the complete supplied source tree, all eight API route files, database schema/migration helpers, frontend API calls, printing/PDF entry points, configuration and package metadata. Generated `.next` and `node_modules` from the old ZIP were not treated as source. The unused `pos.db` contained no tables. Only `pos_database.sqlite` was the application's data source.

Frontend page, layout, CSS and TypeScript POS types are byte-identical to the uploaded files. All eight routes now await MySQL operations on a request-scoped connection. SQLite runtime initialization/sample seeding has been removed. Offline SQLite export/comparison remains available.

Writes use InnoDB transactions on one connection. A singleton database row is locked before every write, serializing requests across app processes for this small POS. Errors and HTTP error responses roll back before releasing the connection. Read requests use a transaction for a consistent multi-query snapshot. Lock-row absence stops writes. Do not manually delete that row or bypass these APIs for concurrent writes.

Headers, lines, item/customer/supplier changes, stock, serial warranty state and quotation conversion commit together. Serialized writes prevent lost stock/payment updates and duplicate generated document numbers. Serial numbers have a case-insensitive unique key; already sold/mismatched serials and duplicate GRN serials are rejected. Negative/invalid payments and payments exceeding outstanding balances are rejected. An invoiced quotation cannot be edited or converted again. Input quantities/money are validated for finite values, signs and whole-number stock quantities. Manual items/serial sales and negative stock remain possible as in the original POS; a stock-blocking policy was not introduced.

MySQL parameter binding uses mysql2 prepared execution. Connection credentials remain server-side. Business SQL timestamps/dashboard dates use a +05:30 session. Original JavaScript invoice/VAT/discount calculations and floating-point storage (`DOUBLE`, matching SQLite REAL) are preserved rather than retroactively rounding historical amounts. Historical NULLs, text, IDs, SQLite ID high-water marks and timestamps are exported; numeric and text column values were compared after import. The schema adds unique document/item/serial indexes, child-header foreign keys and lookup indexes. MariaDB's Unicode case-insensitive collation differs from SQLite ASCII NOCASE for some non-ASCII names; conflicting source names stop import rather than being silently merged.

## Executed successfully

Test date: 12 November 2026. Environment: Linux, Node.js 24.22.1, Next.js 15.5.29, mysql2 3.24.6, real MariaDB 11.8.8. Versions were resolved into package-lock.json; use npm ci.

- SQLite `PRAGMA integrity_check`: `ok`.
- SQLite backup API created the included consistent snapshot, including committed WAL changes.
- Full SQL import into a new MariaDB database passed. A second import into a nonempty database was refused by the provided importer.
- Every column of every imported row matched the SQLite snapshot, not just counts.
- TypeScript check and optimized Next.js production build passed.
- Production frontend returned HTTP 200; all eight API routes were exercised against the real database.
- Automated core workflow checks: bootstrap numeric stats; Unicode settings persistence; item creation/editing; GRN supplier/stock updates; quotation creation/editing; conversion and merged quotation references; VAT/discount totals; cheque fields; credit/unpaid and card/default-paid invoices; partial/full payments; warranty lookup; manual serial sales.
- Concurrent payments preserved both amounts. Two simultaneous sales of the same serial allowed only one commit. Concurrent invoices received distinct codes.
- Late duplicate-serial failures rolled back invoice headers/lines, new customers and stock. Failed GRNs rolled back supplier/stock/cost changes. A late settings constraint error rolled back earlier settings in the same request.
- Invalid negative quantities/payments, overpayment against an outstanding invoice, repeated quotation conversion and editing an invoiced quotation were rejected.
- Frontend page/layout/CSS/types compared byte for byte to the source.

| Source table | Rows migrated |
| --- | ---: |
| settings | 21 |
| items | 6 |
| customers | 1 |
| suppliers | 0 |
| quotations | 5 |
| quotation_items | 7 |
| invoices | 3 |
| invoice_items | 6 |
| grns | 0 |
| grn_items | 0 |
| item_serials | 9 |

Test fixtures were written only to separate disposable databases. They are not present in the supplied SQL or snapshot.

## Not tested / remaining acceptance

This is not a claim that every UI feature is production-proven. The Windows/XAMPP environment, MariaDB 10.4 specifically, Oracle MySQL, printer drivers, physical receipts, PDF visual output, browser interaction on all screens, backup restore on Windows, power-loss recovery, long-running load and multiple physical PCs were not tested here. The SQL targets MariaDB 10.4+ / MySQL 8.0.13+ syntax, with the executed database version stated above.

The original application does not include authentication/roles or idempotency keys. Localhost binding is retained for local PC use. Browser printing/PDF export is unchanged. No silent printing service, cheque clearing ledger, automated startup service, automated backup scheduler or reverse migration was added. An HTTP response lost after commit still needs invoice-list review before retrying.

Run the Windows acceptance and backup/restore steps in INSTALL-WINDOWS.md before live use. `test:core` is destructive to its test database in the sense that it adds fixture records; it requires `POS_TEST_CONFIRM=DISPOSABLE_DB` and must never point at live data. To rerun: import into an isolated empty database, start a separate app instance configured for that database, then set POS_TEST_URL to that instance and run `npm run test:core` with the guard set.
