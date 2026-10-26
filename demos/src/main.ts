import './styles.css';
import './pictures.css';
import { cancelSpeech } from './audio';
import { defaultCollectionId, defaultSystemId } from './content';
import { parseRoute } from './route';
import { onSettingsChange, settings, updateSettings } from './settings';
import { renderHome } from './screens/home';
import { renderTheater } from './screens/theater';
import { renderStory } from './screens/story';
import { renderPath } from './screens/path';
import { renderLesson } from './screens/lesson';
import { renderBook } from './screens/book';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');
const root: HTMLElement = app;

let cleanup: (() => void) | null = null;

/** Hash router. Params are pattern-checked in route.ts and validated by each screen against loaded content. */
function route(): void {
  cleanup?.();
  cleanup = null;
  cancelSpeech();
  window.scrollTo(0, 0);
  const r = parseRoute(location.hash, { system: defaultSystemId(), collection: defaultCollectionId() });
  switch (r.name) {
    case 'theater': cleanup = renderTheater(root, r.sign); break;
    case 'story': cleanup = renderStory(root, r); break;
    case 'learn': cleanup = renderPath(root); break;
    case 'lesson': cleanup = renderLesson(root, r.lesson); break;
    case 'book': cleanup = renderBook(root); break;
    default: cleanup = renderHome(root);
  }
}

let last = { ...settings() };
onSettingsChange((s) => {
  const relayout = s.lang !== last.lang || s.script !== last.script || s.sound !== last.sound;
  last = { ...s };
  if (!s.sound) cancelSpeech();
  if (relayout) route();
});

window.addEventListener('hashchange', route);
updateSettings({}); // sets <html lang>
route();
