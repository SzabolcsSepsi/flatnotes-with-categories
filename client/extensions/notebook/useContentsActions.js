import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createNote, getNote, updateNote } from '../../api.js';
import { useGlobalStore } from '../../globalStore.js';
import { getStoredToken } from '../../tokenStorage.js';
import { categoryOptions, insertEntry } from './contentsEdit.js';

export function useContentsActions({ content, status, refresh, parsed }) {
  const store = useGlobalStore();
  const route = useRoute();
  const router = useRouter();
  const canModify = computed(() => ['password', 'totp', 'none'].includes(store.config.authType));
  const form = ref(null);
  const nameInput = ref();
  const busy = ref(false);
  const message = ref('');
  const failed = ref(false);
  const canStart = computed(() => canModify.value && !store.contentsEditing && !store.contentsWriting && !busy.value &&
    ['ready', 'missing'].includes(status.value) && !parsed.value.error);
  let generation = 0;
  let alive = true;
  let writingRequest = 0;

  function releaseWriter() {
    if (writingRequest) store.contentsWriting = false;
    writingRequest = 0;
  }

  function closeForm() {
    generation++;
    form.value = null;
    busy.value = false;
    message.value = '';
  }
  function openForm(kind, parentId = null) {
    if (!canStart.value) return;
    closeForm();
    form.value = { kind, label: '', parentId, mode: 'create', source: content.value,
      exists: status.value === 'ready', categories: categoryOptions(parsed.value.nodes) };
    nextTick(() => nameInput.value?.focus());
  }
  function active(request, token) {
    return alive && request === generation && route.name !== 'login' &&
      token === getStoredToken() && canModify.value && !store.contentsEditing;
  }
  async function currentSource() {
    try { return { exists: true, source: (await getNote('Contents')).content || '' }; }
    catch (error) {
      if (error.response?.status === 404) return { exists: false, source: '' };
      throw error;
    }
  }
  function unchanged(current, selected) {
    if (current.exists !== selected.exists || current.source !== selected.source) {
      throw new Error('Contents changed. Refresh contents, then choose the category again.');
    }
  }
  async function submit() {
    if (!form.value || !canStart.value) return;
    const selected = { ...form.value, label: form.value.label.trim() };
    const request = ++generation;
    const token = getStoredToken();
    busy.value = true;
    writingRequest = request;
    store.contentsWriting = true;
    message.value = '';
    failed.value = false;
    let created = false;
    let menuWriteSent = false;
    try {
      if (selected.kind === 'note' && selected.label === 'Contents' && selected.mode === 'create') {
        throw new Error('Contents is the menu note. Choose another title, or link it as an existing note.');
      }
      // Validate the entire resulting source before the first write.
      const updated = insertEntry(selected.source, selected);
      const current = await currentSource();
      if (!active(request, token)) return;
      unchanged(current, selected);
      if (selected.kind === 'note') {
        if (selected.mode === 'link') await getNote(selected.label);
        else {
          await createNote(selected.label, '');
          created = true;
        }
        if (!active(request, token)) return;
        // Creating a note and adding its link are two operations, not a transaction.
        const latest = await currentSource();
        if (!active(request, token)) return;
        unchanged(latest, selected);
      }
      if (!active(request, token)) return;
      menuWriteSent = true;
      if (selected.exists) await updateNote('Contents', 'Contents', updated);
      else await createNote('Contents', updated);
      if (!active(request, token)) return;
      form.value = null;
      message.value = selected.kind === 'category' ? 'Category added.' : 'Note added.';
      await refresh();
      if (!active(request, token)) return;
      if (selected.kind === 'note') await router.push({ name: 'note', params: { title: selected.label },
        ...(created ? { query: { edit: '1' } } : {}) });
    } catch (error) {
      if (!active(request, token)) return;
      failed.value = true;
      if (created) {
        message.value = 'The note was created, but could not be added to the menu. Find it in search, or refresh and use Link existing note.';
        form.value.mode = 'link';
      } else if (error.response?.status === 409) {
        message.value = 'A note with this title already exists. Choose Link existing note to add it without changing its content, or use another title.';
      } else if (error.response?.status === 404) {
        message.value = 'That note was not found. Choose Create new note, or check its title.';
      } else if (error.response) {
        message.value = 'Could not save the menu. Refresh and try again. Existing notes have not been replaced.';
      } else message.value = error.message || 'Could not save the menu. Try again.';
    } finally {
      if (writingRequest === request) {
        // Even a same-session route change cannot leave a clean Contents view stale.
        if (menuWriteSent && alive && route.name !== 'login' && token === getStoredToken()) {
          window.dispatchEvent(new CustomEvent('flatnotes:contents-updated'));
        }
        releaseWriter();
      }
      if (alive && request === generation) {
        busy.value = false;
        if (store.contentsEditing) {
          form.value = null;
          message.value = 'Finish editing Contents before changing the menu here.';
        }
      }
    }
  }
  function sessionEnded() { closeForm(); releaseWriter(); }
  window.addEventListener('flatnotes:session-ended', sessionEnded);
  watch(() => route.fullPath, closeForm);
  onBeforeUnmount(() => {
    alive = false;
    closeForm();
    releaseWriter();
    window.removeEventListener('flatnotes:session-ended', sessionEnded);
  });
  return { store, canModify, canStart, form, nameInput, busy, message, failed, openForm, closeForm, submit };
}
