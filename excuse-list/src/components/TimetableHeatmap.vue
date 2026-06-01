<script setup lang="ts">
import { computed } from 'vue'

interface HeatmapCell {
  dayOfWeek: number // 0=Mon … 4=Fri
  period: number // 0–16 (EH)
  count: number
}

const props = defineProps<{ cells: HeatmapCell[] }>()

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

// Start time of each EH (period), matching the school's bell schedule.
const TIMES = [
  '07:05', '08:00', '08:55', '10:00', '10:55', '11:50', '12:45', '13:40',
  '14:35', '15:30', '16:25', '17:20', '18:05', '19:00', '19:45', '20:40', '21:25',
]

// Show period 0 down to the last period that has data, but always at least the
// normal day-school span (0–10). Keeps the grid timetable-shaped without the
// empty evening (Abendschule) rows when they aren't needed.
const maxPeriod = computed(() =>
  Math.min(16, Math.max(10, ...props.cells.map((c) => c.period))),
)
const periods = computed(() => Array.from({ length: maxPeriod.value + 1 }, (_, i) => i))

const maxCount = computed(() => props.cells.reduce((m, c) => Math.max(m, c.count), 0))

// grid[period][day] = count
const grid = computed<number[][]>(() => {
  const g = Array.from({ length: maxPeriod.value + 1 }, () => Array(5).fill(0))
  for (const c of props.cells) {
    if (c.dayOfWeek >= 0 && c.dayOfWeek < 5 && c.period >= 0 && c.period <= maxPeriod.value) {
      g[c.period]![c.dayOfWeek] = c.count
    }
  }
  return g
})

const cellCount = (p: number, d: number): number => grid.value[p]?.[d] ?? 0
const timeLabel = (p: number): string => TIMES[p] ?? ''

// Proportional shading (spec Q7/Q13): empty = near-white, busiest cell = full blue.
function cellStyle(count: number) {
  if (count <= 0) return { background: '#f8fafc', color: '#cbd5e1' }
  const alpha = 0.18 + 0.82 * (count / (maxCount.value || 1))
  return { background: `rgba(37, 99, 235, ${alpha})`, color: alpha > 0.55 ? '#ffffff' : '#1e3a8a' }
}
</script>

<template>
  <div class="overflow-x-auto">
    <div
      class="grid gap-1 min-w-[440px]"
      :style="{ gridTemplateColumns: 'minmax(64px, auto) repeat(5, minmax(0, 1fr))' }"
    >
      <!-- Header row: empty corner + day labels -->
      <div></div>
      <div
        v-for="day in DAYS"
        :key="day"
        class="text-center text-xs font-black text-gray-500 uppercase pb-1"
      >
        {{ day }}
      </div>

      <!-- One row per period (0. EH at the top, descending) -->
      <template v-for="p in periods" :key="p">
        <div class="flex items-center justify-end gap-1 pr-2 text-right whitespace-nowrap">
          <span class="text-[11px] font-bold text-gray-500">{{ p }}. EH</span>
          <span class="text-[10px] text-gray-300 tabular-nums hidden sm:inline">{{ timeLabel(p) }}</span>
        </div>
        <div
          v-for="(day, di) in DAYS"
          :key="di"
          class="h-9 rounded-md flex items-center justify-center text-[11px] font-bold tabular-nums border border-gray-100"
          :style="cellStyle(cellCount(p, di))"
          :title="`${day}, ${p}. EH — ${cellCount(p, di)} Fehlstunden`"
        >
          <span v-if="cellCount(p, di) > 0">{{ cellCount(p, di) }}</span>
        </div>
      </template>
    </div>

    <p class="text-[11px] text-gray-400 mt-3">
      Zelle = Wochentag × Einheit · Zahl = versäumte Stunden · dunkler = mehr
    </p>
  </div>
</template>
