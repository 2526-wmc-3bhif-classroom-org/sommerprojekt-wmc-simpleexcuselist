<script setup lang="ts">
import { computed } from 'vue'
import { subjectColor, subjectBg, subjectFg } from '@/utils/subjectColor'

interface HeatmapCell {
  dayOfWeek: number // 0=Mon … 4=Fri
  period: number // 0–16 (EH)
  count: number
  subjects?: string[]
}

const props = defineProps<{ cells: HeatmapCell[] }>()

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const TIMES = [
  '07:05', '08:00', '08:55', '10:00', '10:55', '11:50', '12:45', '13:40',
  '14:35', '15:30', '16:25', '17:20', '18:05', '19:00', '19:45', '20:40', '21:25',
]

const maxPeriod = computed(() =>
  Math.min(16, Math.max(10, ...props.cells.map((c) => c.period))),
)
const periods = computed(() => Array.from({ length: maxPeriod.value + 1 }, (_, i) => i))
const maxCount = computed(() => props.cells.reduce((m, c) => Math.max(m, c.count), 0))

const getCell = (p: number, d: number): HeatmapCell | undefined =>
  props.cells.find((c) => c.period === p && c.dayOfWeek === d)

const cellCount = (p: number, d: number): number => getCell(p, d)?.count ?? 0

const cellSubjects = (p: number, d: number): string[] => getCell(p, d)?.subjects ?? []

const timeLabel = (p: number): string => TIMES[p] ?? ''

// Primary subject abbreviation shown in cell; "+N" suffix if more exist.
const cellLabel = (p: number, d: number): string => {
  const subs = cellSubjects(p, d)
  if (subs.length === 0) return ''
  if (subs.length === 1) return subs[0]!
  return `${subs[0]}+${subs.length - 1}`
}

// Relative intensity tier: 0 (none) … 4 (worst), scaled against the busiest cell
// so the heaviest absences always reach the top tier regardless of absolute count.
const cellTier = (p: number, d: number): number => {
  const count = cellCount(p, d)
  if (count <= 0) return 0
  return Math.min(4, Math.ceil((count / (maxCount.value || 1)) * 4))
}

// Discrete fill opacity per tier — stepped (not a smooth ramp) so adjacent tiers
// read clearly apart instead of blending together.
const TIER_ALPHA = [0, 0.3, 0.52, 0.74, 1] as const

// Second channel: the count numeral grows with tier, so frequently-missed lessons
// stand out by size as well as colour — noticeable even at a glance.
const TIER_NUM_CLASS = ['', 'text-[10px]', 'text-[12px]', 'text-[14px]', 'text-[16px]'] as const

const cellNumClass = (p: number, d: number): string => TIER_NUM_CLASS[cellTier(p, d)]!

function cellStyle(p: number, d: number): Record<string, string> {
  const count = cellCount(p, d)
  if (count <= 0) return { background: '#f1f5f9', color: '#cbd5e1', borderColor: 'transparent' }
  const tier = cellTier(p, d)
  const alpha = TIER_ALPHA[tier]!
  // Ring thickens for the top tiers — a third reinforcing size cue on the worst offenders.
  const borderWidth = tier >= 3 ? '2px' : '1px'
  const primary = cellSubjects(p, d)[0]
  if (primary) {
    return {
      background: subjectBg(primary, alpha),
      color: subjectFg(alpha),
      borderColor: subjectBg(primary, Math.min(1, alpha + 0.25)),
      borderWidth,
    }
  }
  return {
    background: `rgba(37,99,235,${alpha})`,
    color: alpha > 0.55 ? '#ffffff' : '#1e3a8a',
    borderColor: `rgba(37,99,235,${Math.min(1, alpha + 0.25)})`,
    borderWidth,
  }
}

// Collect all unique subjects across all cells for the legend.
const allSubjects = computed(() => {
  const seen = new Set<string>()
  for (const c of props.cells) {
    for (const s of c.subjects ?? []) seen.add(s)
  }
  return [...seen].sort()
})

const cellTooltip = (p: number, d: number): string => {
  const count = cellCount(p, d)
  const subs = cellSubjects(p, d)
  const subLabel = subs.length ? ` · ${subs.join(', ')}` : ''
  return `${DAYS[d]}, ${p}. EH — ${count} Fehlstunden${subLabel}`
}
</script>

<template>
  <div class="space-y-4">
    <div class="overflow-x-auto">
      <div
        class="grid gap-1 min-w-[480px]"
        :style="{ gridTemplateColumns: 'minmax(68px, auto) repeat(5, minmax(0, 1fr))' }"
      >
        <!-- Header row -->
        <div></div>
        <div
          v-for="day in DAYS"
          :key="day"
          class="text-center text-xs font-black text-gray-500 uppercase pb-1 tracking-wider"
        >
          {{ day }}
        </div>

        <!-- Period rows -->
        <template v-for="p in periods" :key="p">
          <!-- Time label -->
          <div class="flex items-center justify-end gap-1.5 pr-2 text-right whitespace-nowrap">
            <span class="text-[11px] font-bold text-gray-500">{{ p }}. EH</span>
            <span class="text-[10px] text-gray-300 tabular-nums hidden sm:inline">{{ timeLabel(p) }}</span>
          </div>

          <!-- Day cells -->
          <div
            v-for="(day, di) in DAYS"
            :key="di"
            class="rounded-md flex flex-col items-center justify-center border border-transparent text-center overflow-hidden transition-transform hover:scale-105 cursor-default"
            style="min-height: 48px;"
            :style="cellStyle(p, di)"
            :title="cellTooltip(p, di)"
          >
            <template v-if="cellCount(p, di) > 0">
              <span class="text-[12px] font-black leading-tight tracking-tight px-1 truncate w-full text-center">
                {{ cellLabel(p, di) }}
              </span>
              <span
                class="font-bold leading-tight opacity-90 tabular-nums"
                :class="cellNumClass(p, di)"
              >
                {{ cellCount(p, di) }}&thinsp;×
              </span>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Subject color legend -->
    <div v-if="allSubjects.length > 0" class="flex flex-wrap gap-2 pt-1">
      <div
        v-for="sub in allSubjects"
        :key="sub"
        class="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700"
      >
        <span
          class="w-3 h-3 rounded-sm flex-shrink-0"
          :style="{ background: subjectColor(sub) }"
        ></span>
        {{ sub }}
      </div>
    </div>

    <p class="text-[11px] text-gray-400">
      Zelle = Wochentag × Einheit · Zahl = versäumte Stunden · dunkler &amp; größer = mehr Fehlstunden
    </p>
  </div>
</template>
