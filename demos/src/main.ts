import './styles.css';
import './pictures.css';
import { cancelSpeech } from './audio';
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

/** Hash router. Route params come from the URL, so every screen validates them against allow-lists. */
function route(): void {
  cleanup?.();
  cleanup = null;
  cancelSpeech();
  const [name = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  let param = '';
  try { param = decodeURIComponent(arg); } catch { param = ''; }
  window.scrollTo(0, 0);
  switch (name) {
    case 'theater': cleanup = renderTheater(root, param); break;
    case 'story': cleanup = renderStory(root, param); break;
    case 'learn': cleanup = renderPath(root); break;
    case 'lesson': cleanup = renderLesson(root, param); break;
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
