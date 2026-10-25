/** A localized string: locale id → text. Content may omit non-base locales; compiled bundles carry every locale. */
export type L10n = Record<string, string>;

/** BCP 47 subset used here: language plus optional ISO 15924 script, e.g. en, zh-Hans. */
export const LOCALE_ID = /^[a-z]{2,3}(-[A-Z][a-z]{3})?$/;
