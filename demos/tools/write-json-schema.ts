// npm run schema — regenerate content/_schema/*.schema.json from the Zod schemas.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR } from './paths.ts';
import { renderJsonSchemas } from './content/json-schema.ts';

const dir = path.join(CONTENT_DIR, '_schema');
mkdirSync(dir, { recursive: true });
for (const [name, text] of renderJsonSchemas(['en', 'zh-Hans', 'zh-Hant'])) writeFileSync(path.join(dir, name), text);
console.log(`schema: wrote ${dir}`);
