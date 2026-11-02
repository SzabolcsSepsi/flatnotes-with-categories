<template>
  <details class="notebook-sidebar print:hidden" open>
    <summary class="notebook-menu">Contents menu</summary>
    <nav aria-label="Notebook contents">
      <div class="notebook-shortcuts">
        <RouterLink :to="{ name: 'note', params: { title: 'Home' } }">Home note</RouterLink>
        <RouterLink :to="{ name: 'home', query: { view: 'tasks' } }">Tasks by date</RouterLink>
        <RouterLink :to="{ name: 'search', query: { term: '*' } }">Search all notes</RouterLink>
        <RouterLink :to="{ name: 'note', params: { title: 'Contents' } }">Open / edit contents</RouterLink>
      </div>
      <button class="notebook-button" :disabled="status === 'loading'" @click="refresh">Refresh contents</button>
      <p v-if="status === 'loading'" role="status">Loading contents…</p>
      <p v-else-if="status === 'missing'">Create a note titled Contents with headings and note links to organise this menu.</p>
      <p v-else-if="status === 'error'" role="alert">Could not load contents. Search and editing remain available.</p>
      <p v-else-if="parsed.error" role="alert">{{ parsed.error }}</p>
      <template v-else-if="status === 'ready'">
        <ContentsTree :nodes="parsed.nodes" />
        <p v-if="!parsed.nodes.length">Add headings and standalone bullet links such as [[Note title]] to Contents.</p>
        <p v-if="parsed.ignored" class="notebook-hint">Some unsupported entries were skipped. Use headings and standalone note links.</p>
      </template>
    </nav>
  </details>
</template>
<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import ContentsTree from './ContentsTree.vue';
import { parseContents } from './parse.js';
import { usePrivateNote } from './usePrivateNote.js';
const { content, status, refresh } = usePrivateNote('Contents');
const parsed = computed(() => {
  try { return parseContents(content.value); }
  catch (error) { return { nodes: [], error: error.message }; }
});
</script>
