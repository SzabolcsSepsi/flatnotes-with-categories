import { defineStore } from "pinia";
import { ref } from "vue";

export const useGlobalStore = defineStore("global", () => {
  const config = ref({});
  const contentsEditing = ref(false);
  const contentsWriting = ref(false);

  return { config, contentsEditing, contentsWriting };
});
