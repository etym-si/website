import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Diags, formatDiagnostic } from '../../tools/content/diagnostics.ts';
import { parseYamlText } from '../../tools/content/yaml.ts';
import { REPO } from '../../tools/paths.ts';

const parse = (text: string) => {
  const diags = new Diags();
  const y = parseYamlText(`${REPO}/content/x.yaml`, text, diags);
  return { y, diags };
};

test('plain YAML parses to data', () => {
  const { y, diags } = parse('id: 马\ntext: { Hans: 马, Hant: 馬 }\n');
  assert.equal(diags.list.length, 0);
  assert.deepEqual(y?.data, { id: '马', text: { Hans: '马', Hant: '馬' } });
});

test('duplicate keys are rejected with a line number', () => {
  const { y, diags } = parse('a: 1\nb: 2\na: 3\n');
  assert.equal(y, null);
  assert.equal(diags.errors.length, 1);
  assert.match(formatDiagnostic(diags.errors[0]), /^content\/x\.yaml:3:1 Map keys must be unique/);
});

test('explicit and custom tags are rejected', () => {
  assert.equal(parse('a: !!binary aGk=\n').y, null);
  assert.equal(parse('a: !foo bar\n').y, null);
  assert.equal(parse('a: !!str 5\n').y, null);
});

test('alias bombs are rejected', () => {
  const bomb = 'a: &a [x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: [*c,*c,*c,*c,*c,*c,*c,*c,*c]\n';
  const { y, diags } = parse(bomb);
  assert.equal(y, null);
  assert.match(diags.errors[0].message, /alias/i);
});
