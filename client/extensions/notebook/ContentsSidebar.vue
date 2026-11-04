<template>
  <details class="notebook-sidebar print:hidden" open>
    <summary class="notebook-menu">Contents menu</summary>
    <nav aria-label="Notebook contents">
      <div class="notebook-shortcuts">
        <RouterLink :to="{ name: 'note', params: { title: 'Home' } }"><NotebookIcon name="home" />todo</RouterLink>
        <RouterLink :to="{ name: 'home', query: { view: 'tasks' } }"><NotebookIcon name="calendar" />Tasks by date</RouterLink>
        <RouterLink :to="{ name: 'search', query: { term: '*' } }"><NotebookIcon name="search" />Search all notes</RouterLink>
      </div>
      <div v-if="canModify" class="notebook-create-actions">
        <button class="notebook-button notebook-primary" :disabled="!canStart" @click="openForm('note')"><NotebookIcon name="addNote" />Add note</button>
        <button class="notebook-button" :disabled="!canStart" @click="openForm('category')"><NotebookIcon name="category" />Add category</button>
      </div>
      <p v-if="store.contentsEditing" class="notebook-hint">Finish editing Contents before changing the menu here.</p>
      <form v-if="form" class="notebook-entry-form" :aria-label="form.kind === 'category' ? 'Add category' : 'Add note'" @submit.prevent="submit">
        <div class="notebook-form-heading">{{ form.kind === 'category' ? 'New category' : 'Add a note' }}</div>
        <label v-if="form.kind === 'note'" for="notebook-note-action">Note action</label>
        <select v-if="form.kind === 'note'" id="notebook-note-action" v-model="form.mode" :disabled="busy">
          <option value="create">Create new note</option><option value="link">Link existing note</option>
        </select>
        <label for="notebook-entry-name">{{ form.kind === 'category' ? 'Category name' : 'Note title' }}</label>
        <input id="notebook-entry-name" ref="nameInput" v-model="form.label" :maxlength="form.kind === 'category' ? 128 : 240" autocomplete="off" required :disabled="busy" />
        <label for="notebook-parent-category">{{ form.kind === 'category' ? 'Parent category' : 'Category' }}</label>
        <select id="notebook-parent-category" v-model="form.parentId" :disabled="busy">
          <option :value="null">Top level</option>
          <option v-for="category in form.categories" :key="category.id" :value="category.id">{{ category.label }}</option>
        </select>
        <div class="notebook-form-buttons">
          <button class="notebook-button notebook-primary" :disabled="busy || !canStart" type="submit">{{ busy ? 'Saving…' : form.kind === 'category' ? 'Create category' : form.mode === 'link' ? 'Add link' : 'Create note' }}</button>
          <button class="notebook-button" type="button" :disabled="busy" @click="closeForm">Cancel</button>
        </div>
      </form>
      <p v-if="message" :role="failed ? 'alert' : 'status'" :class="failed ? 'notebook-error' : 'notebook-hint'">{{ message }}</p>
      <p v-if="status === 'loading'" class="notebook-hint" role="status">Loading contents…</p>
      <p v-else-if="status === 'error'" role="alert">Could not load contents. Try refreshing.</p>
      <p v-else-if="parsed.error" role="alert">{{ parsed.error }}</p>
      <template v-else-if="status === 'ready' || status === 'missing'">
        <ContentsTree :nodes="parsed.nodes" :can-modify="canStart" @add="openForm($event.kind, $event.parentId)" />
        <div v-if="!parsed.nodes.length && !form" class="notebook-empty">
          <NotebookIcon name="folder" /><strong>Your notes, organised</strong>
          <p>{{ canModify ? 'Add your first category, then create or add notes inside it.' : 'No categories yet.' }}</p>
        </div>
        <p v-if="parsed.ignored" class="notebook-hint">Extra text in Contents is preserved. Some entries are not part of this menu.</p>
      </template>
      <div class="notebook-tools">
        <button :disabled="busy || status === 'loading'" class="notebook-tool" title="Refresh contents" aria-label="Refresh contents" @click="refresh"><NotebookIcon name="refresh" /></button>
        <RouterLink class="notebook-tool" :to="{ name: 'note', params: { title: 'Contents' } }" title="Open / edit contents" aria-label="Open / edit contents"><NotebookIcon name="edit" /></RouterLink>
      </div>
    </nav>
  </details>
</template>
<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import ContentsTree from './ContentsTree.vue';
import NotebookIcon from './NotebookIcon.vue';
import { parseContents } from './parse.js';
import { usePrivateNote } from './usePrivateNote.js';
import { useContentsActions } from './useContentsActions.js';
const { content, status, refresh } = usePrivateNote('Contents');
const parsed = computed(() => {
  try { return parseContents(content.value); }
  catch (error) { return { nodes: [], error: error.message }; }
});
const { store, canModify, canStart, form, nameInput, busy, message, failed, openForm, closeForm, submit } =
  useContentsActions({ content, status, refresh, parsed });
</script>
