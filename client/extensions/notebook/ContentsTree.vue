<template>
  <ul class="notebook-tree">
    <li v-for="node in nodes" :key="node.id">
      <details v-if="node.kind === 'category'" open>
        <summary><span class="notebook-category-label"><NotebookIcon name="folder" />{{ node.label }}</span></summary>
        <div v-if="canModify" class="notebook-category-actions">
          <button class="notebook-tool" :aria-label="`Add note to ${node.label}`" :title="`Add note to ${node.label}`" @click="$emit('add', { kind: 'note', parentId: node.id })"><NotebookIcon name="addNote" /></button>
          <button v-if="node.level < 6" class="notebook-tool" :aria-label="`Add subcategory to ${node.label}`" :title="`Add subcategory to ${node.label}`" @click="$emit('add', { kind: 'category', parentId: node.id })"><NotebookIcon name="category" /></button>
        </div>
        <ContentsTree :nodes="node.children" :can-modify="canModify" @add="$emit('add', $event)" />
      </details>
      <RouterLink v-else :to="{ name: 'note', params: { title: node.label } }"
        :aria-current="route.name === 'note' && route.params.title === node.label ? 'page' : undefined">
        <NotebookIcon name="note" /><span>{{ node.label }}</span>
      </RouterLink>
    </li>
  </ul>
</template>
<script setup>
import { RouterLink, useRoute } from 'vue-router';
import NotebookIcon from './NotebookIcon.vue';
defineProps({ nodes: { type: Array, required: true }, canModify: Boolean });
defineEmits(['add']);
const route = useRoute();
</script>
