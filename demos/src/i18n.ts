// UI strings come from content/ui.yaml (inlined through the catalog); content texts are L10n records keyed by
// locale id. The UI language (EN/中文) and the character script (简/繁) are independent settings.
import type { UiKey } from '@generated/ui-keys.ts';
import type { L10n } from '../shared/l10n.ts';
import { CATALOG } from './content';
import { settings } from './settings';

export type { L10n };
export type StrKey = UiKey;

/** The UI locale for the current settings. */
export function locale(): string {
  const s = settings();
  return s.lang === 'en' ? 'en' : s.script === 'trad' ? 'zh-Hant' : 'zh-Hans';
}

/** The text script used to show signs (简 → Hans, 繁 → Hant), whatever the UI language. */
export function textScript(): 'Hans' | 'Hant' {
  return settings().script === 'trad' ? 'Hant' : 'Hans';
}

/** Pick the right variant for the current UI language + script. */
export function tx(t: L10n): string {
  return t[locale()] ?? t.en ?? '';
}

/** A localized text with the runtime token {shown} replaced by the sign in the reader's script. */
export function txShown(t: L10n, shown: string): string {
  return tx(t).replaceAll('{shown}', shown);
}

/** A sign as the reader sees it: its text in the chosen script, else its first text (e.g. Egyp). */
export function signText(text: Record<string, string>): string {
  return text[textScript()] ?? Object.values(text)[0] ?? '';
}

export function t(key: UiKey): string {
  return tx(CATALOG.ui[key]);
}
