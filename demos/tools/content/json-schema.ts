// Editor autocomplete: content/_schema/*.schema.json, generated from the Zod schemas (spec §2, §9).
import { z } from 'zod';
import { ConfigSchema, makeSchemas } from './schema.ts';

export function renderJsonSchemas(locales: readonly string[]): Map<string, string> {
  const S = makeSchemas(locales);
  const all: Record<string, z.ZodType> = {
    config: ConfigSchema, ui: S.Ui, system: S.System, sign: S.Sign, artifact: S.Artifact, source: S.Source, collection: S.Collection, story: S.Story,
  };
  const out = new Map<string, string>();
  for (const [name, schema] of Object.entries(all)) {
    const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' });
    out.set(`${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
  }
  return out;
}
