import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getNote } from '../../api.js';
import { getStoredToken } from '../../tokenStorage.js';

// In-memory only. A late response must never revive data after logout/unmount.
export function usePrivateNote(title) {
  const content = ref('');
  const status = ref('loading');
  const route = useRoute();
  const router = useRouter();
  let generation = 0;
  let alive = true;
  let busy = false;
  function clear() {
    generation++;
    content.value = '';
    status.value = 'idle';
    busy = false;
  }
  async function refresh() {
    if (!alive || route.name === 'login' || busy) return;
    const request = ++generation;
    const originatingToken = getStoredToken();
    busy = true;
    content.value = '';
    status.value = 'loading';
    try {
      const note = await getNote(title);
      if (!alive || request !== generation || route.name === 'login' || originatingToken !== getStoredToken()) return;
      content.value = note.content || '';
      status.value = 'ready';
    } catch (error) {
      if (!alive || request !== generation) return;
      if (originatingToken !== getStoredToken()) { status.value = 'idle'; return; }
      status.value = error.response?.status === 404 ? 'missing' : 'error';
      if (error.response?.status === 401) {
        clear();
        router.push({ name: 'login' });
      }
      // Do not log Axios errors: they can include private request/response data.
    } finally {
      if (request === generation) busy = false;
    }
  }
  window.addEventListener('flatnotes:session-ended', clear);
  window.addEventListener('flatnotes:note-saved', saved);
  function saved(event) { if (event.detail === title) refresh(); }
  watch(() => route.fullPath, () => {
    if (route.name === 'login') clear();
    else refresh();
  }, { immediate: true, flush: 'sync' });
  onBeforeUnmount(() => {
    alive = false;
    clear();
    window.removeEventListener('flatnotes:session-ended', clear);
    window.removeEventListener('flatnotes:note-saved', saved);
  });
  return { content, status, refresh };
}
