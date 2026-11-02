<template>
  <ul class="notebook-tree">
    <li v-for="node in nodes" :key="node.id">
      <details v-if="node.kind === 'category'" open>
        <summary>{{ node.label }}</summary>
        <ContentsTree :nodes="node.children" />
      </details>
      <RouterLink v-else :to="{ name: 'note', params: { title: node.label } }"
        :aria-current="route.name === 'note' && route.params.title === node.label ? 'page' : undefined">
        {{ node.label }}
      </RouterLink>
    </li>
  </ul>
</template>
<script setup>
import { RouterLink, useRoute } from 'vue-router';
defineProps({ nodes: { type: Array, required: true } });
const route = useRoute();
</script>
