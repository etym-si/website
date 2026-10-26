// Hash routes. Params come from the URL: segments are decoded defensively and pattern-checked here; screens
// then validate them against the loaded catalog/collection. Legacy links (#/theater/马, #/story/3,
// #/lesson/u1-l1) resolve against the default system and collection.
export type Route =
  | { name: 'home' }
  | { name: 'theater'; sign: string | null }
  | { name: 'story'; collection: string; story: string | null; index: number }
  | { name: 'learn'; collection: string }
  | { name: 'lesson'; collection: string; lesson: string }
  | { name: 'book'; collection: string };

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SIGN_ID = /^[^/\s]{1,32}$/;

export function parseRoute(hash: string, defaults: { system: string; collection: string }): Route {
  const segs = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return ''; }
  });
  const [name = '', a = '', b = ''] = segs;
  switch (name) {
    case 'theater':
      if (a && b && SLUG.test(a) && SIGN_ID.test(b)) return { name, sign: `${a}/${b}` };
      if (a && !b && SIGN_ID.test(a)) return { name, sign: `${defaults.system}/${a}` };
      return { name, sign: null };
    case 'story':
      if (a && b && SLUG.test(a) && SLUG.test(b)) return { name, collection: a, story: b, index: 1 };
      return { name, collection: defaults.collection, story: null, index: Math.max(1, parseInt(a, 10) || 1) };
    case 'learn':
      return { name, collection: SLUG.test(a) ? a : defaults.collection };
    case 'lesson':
      if (a && b && SLUG.test(a) && SLUG.test(b)) return { name, collection: a, lesson: b };
      return { name, collection: defaults.collection, lesson: SLUG.test(a) ? a : '' };
    case 'book':
      return { name, collection: SLUG.test(a) ? a : defaults.collection };
    default:
      return { name: 'home' };
  }
}
