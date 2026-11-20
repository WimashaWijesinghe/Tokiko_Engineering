# Simple POS — MySQL/XAMPP edition

Start with **INSTALL-WINDOWS.md**. It covers database import, `.env.local`, installation, startup, backups and migration from a newer local SQLite database.

- `database/mysql-import.sql`: complete schema + uploaded project's existing data; import once into a new empty database.
- `database/schema.sql`: reference schema, not a second import step.
- `.env.example`: copy to `.env.local` and enter your local DB credentials.
- `migration/source/pos_database.sqlite`: integrity-checked, WAL-aware snapshot for recovery/comparison; never used by runtime APIs.
- `scripts/export-sqlite.mjs`: regenerate SQL from a stopped, newer SQLite database.
- `scripts/db-check.mjs`: connection/count checks, or exact source comparison before first use.
- `VALIDATION.md`: executed checks and remaining acceptance work.

```bat
npm ci
npm run db:compare
npm run build
npm start
```

The original frontend is retained byte for byte. There is no separate Express server. The source ZIP excludes generated build output and dependencies: install and build on Windows, then use `start-pos.bat`.
