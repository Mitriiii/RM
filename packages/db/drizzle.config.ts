import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set — see .env.example');
}

export default defineConfig({
  // drizzle-kit's own TS loader does not resolve the `.js`-suffixed relative imports that
  // NodeNext module resolution requires in src/ (see docs/decisions — a drizzle-kit/NodeNext
  // interop limitation, not a design choice), so it reads the compiled output instead. Run
  // `pnpm build` before `db:generate` if the schema changed.
  schema: './dist/schema/index.js',
  out: './migrations',
  dialect: 'postgresql',
  schemaFilter: ['public', 'cost'],
  dbCredentials: { url: databaseUrl },
});
