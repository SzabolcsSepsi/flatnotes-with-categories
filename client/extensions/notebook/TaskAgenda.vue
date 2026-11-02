<template>
  <section class="notebook-agenda" aria-labelledby="tasks-title">
    <h1 id="tasks-title" class="text-3xl">Tasks by date</h1>
    <p>Read from Home, earliest first. Edit the Home note to add or change entries.</p>
    <div class="notebook-actions">
      <RouterLink :to="{ name: 'note', params: { title: 'Home' } }">Open / edit Home</RouterLink>
      <button class="notebook-button" :disabled="status === 'loading'" @click="refresh">Refresh tasks</button>
      <button class="notebook-button" :aria-pressed="calendar" @click="calendar = !calendar">{{ calendar ? 'List view' : 'Month view' }}</button>
      <label><input v-model="includeDone" type="checkbox" /> Show completed</label>
    </div>
    <p v-if="status === 'loading'" role="status">Loading tasks…</p>
    <p v-else-if="status === 'missing'">Home does not exist yet. Create a note titled Home with dated tasks. Nothing is created automatically.</p>
    <p v-else-if="status === 'error'" role="alert">Could not load tasks.</p>
    <p v-else-if="parsed.error" role="alert">{{ parsed.error }}</p>
    <template v-else-if="status === 'ready'">
      <p class="notebook-hint">Format: - [ ] YYYY-MM-DD — Task description</p>
      <p v-if="parsed.ignored">Some tasks have unsupported dates or formatting and are not shown.</p>
      <template v-if="calendar">
        <div class="notebook-actions">
          <button class="notebook-button" :disabled="year <= 1000 && month === 1" @click="moveMonth(-1)">Previous month</button>
          <h2>{{ monthLabel }}</h2>
          <button class="notebook-button" :disabled="year >= 9999 && month === 12" @click="moveMonth(1)">Next month</button>
        </div>
        <div class="notebook-calendar" aria-label="Month calendar">
          <strong v-for="day in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="day">{{ day }}</strong>
          <div v-for="(cell, i) in cells" :key="i" class="notebook-day">
            <template v-if="cell">
              <time :datetime="cell.date">{{ cell.day }}</time>
              <p v-for="task in byDate.get(cell.date) || []" :key="task.id" :class="{ 'notebook-done': task.done }">{{ task.title }}</p>
            </template>
          </div>
        </div>
      </template>
      <ol v-else class="notebook-task-list">
        <li v-for="task in visibleTasks" :key="task.id" :class="{ 'notebook-done': task.done }">
          <time :datetime="task.date">{{ task.date }}</time><span>{{ task.title }}</span>
        </li>
      </ol>
      <p v-if="!visibleTasks.length">No dated tasks to display.</p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { monthCells, parseTasks } from './parse.js';
import { usePrivateNote } from './usePrivateNote.js';
const { content, status, refresh } = usePrivateNote('Home');
const calendar = ref(false);
const includeDone = ref(false);
const today = new Date();
const year = ref(today.getFullYear());
const month = ref(today.getMonth() + 1);
const parsed = computed(() => {
  try { return parseTasks(content.value); }
  catch (error) { return { tasks: [], error: error.message }; }
});
const visibleTasks = computed(() => parsed.value.tasks.filter(t => includeDone.value || !t.done));
const byDate = computed(() => {
  const map = new Map();
  for (const task of visibleTasks.value) {
    if (!map.has(task.date)) map.set(task.date, []);
    map.get(task.date).push(task);
  }
  return map;
});
const cells = computed(() => monthCells(year.value, month.value));
const monthLabel = computed(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(new Date(year.value, month.value - 1, 1)));
function moveMonth(delta) {
  const date = new Date(year.value, month.value - 1 + delta, 1);
  if (date.getFullYear() < 1000 || date.getFullYear() > 9999) return;
  year.value = date.getFullYear(); month.value = date.getMonth() + 1;
}
</script>
