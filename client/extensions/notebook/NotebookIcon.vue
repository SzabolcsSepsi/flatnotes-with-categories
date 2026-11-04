<template>
  <svg class="notebook-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path :d="paths[name]" /></svg>
</template>
<script setup>
import { mdiHomeOutline, mdiCalendarMonthOutline, mdiMagnify, mdiFolderOutline,
  mdiFolderPlusOutline, mdiFileDocumentOutline, mdiFilePlusOutline, mdiRefresh, mdiPencilOutline } from '@mdi/js';
defineProps({ name: String });
const paths = { home: mdiHomeOutline, calendar: mdiCalendarMonthOutline, search: mdiMagnify,
  folder: mdiFolderOutline, category: mdiFolderPlusOutline, note: mdiFileDocumentOutline,
  addNote: mdiFilePlusOutline, refresh: mdiRefresh, edit: mdiPencilOutline };
</script>
