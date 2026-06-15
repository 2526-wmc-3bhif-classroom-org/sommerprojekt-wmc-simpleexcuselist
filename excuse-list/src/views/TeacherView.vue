<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import TimetableHeatmap from '@/components/TimetableHeatmap.vue'
import { subjectColor } from '@/utils/subjectColor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  untisId: number
  firstName: string
  lastName: string
  className: string
}

interface Absence {
  id: string
  date: number
  startTime: number
  endTime: number
  status: string
  excuseMessage?: string
}

interface Attachment {
  fileName: string
  fileData: string
}

interface SubjectStat {
  subjectName: string
  subjectLongName: string
  missedLessons: number
  totalLessons: number | null
  percentage: number | null
}

interface HeatmapCell {
  dayOfWeek: number
  period: number
  count: number
}

interface StudentTopSubjects {
  untisId: number
  firstName: string
  lastName: string
  top3: SubjectStat[]
}

interface BehaviorEntry {
  untisId: number
  firstName: string
  lastName: string
  totalHours: number
  unexcusedHours: number
}

interface AnalyticsPayload {
  stats: SubjectStat[]
  heatmap: HeatmapCell[]
  totalHours: number
  unexcusedHours: number
}

interface ClassAnalyticsPayload {
  stats: SubjectStat[]
  heatmap: HeatmapCell[]
  studentTable: StudentTopSubjects[]
}

// ─── State ────────────────────────────────────────────────────────────────────

const router = useRouter()
const students = ref<Student[]>([])
const selectedStudent = ref<Student | null>(null)
const absences = ref<Absence[]>([])
const loadingStudents = ref(true)
const loadingAbsences = ref(false)
const error = ref('')
const teacherName = ref('')
const teacherClass = ref('')
const totalHours = ref(0)
const unexcusedHours = ref(0)


// Student analytics
const showAnalytics = ref(false)
const analyticsMode = ref<'open' | 'all'>('open')
const analytics = ref<AnalyticsPayload>({ stats: [], heatmap: [], totalHours: 0, unexcusedHours: 0 })
const loadingAnalytics = ref(false)
// Date-range filter (YYYY-MM-DD from native date inputs); empty = unbounded.
const analyticsFrom = ref('')
const analyticsTo = ref('')

// Class analytics — always over all absences (no open/all toggle).
const showClassAnalytics = ref(false)
const classAnalytics = ref<ClassAnalyticsPayload>({ stats: [], heatmap: [], studentTable: [] })
const loadingClassAnalytics = ref(false)
const classFrom = ref('')
const classTo = ref('')

// Behavior summary (all students, all absences regardless of status)
const behaviorSummary = ref<BehaviorEntry[]>([])

// Attachments modal
const showAttachmentModal = ref(false)
const loadingAttachments = ref(false)
const activeAttachments = ref<Attachment[]>([])
const activeExcuseMessage = ref('')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = () => {
  const token = localStorage.getItem('untis_jwt')
  if (!token) { router.push('/'); return null }
  return token
}

const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1]!;
    const padLength = (4 - (base64Url.length % 4)) % 4;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
    const payload = JSON.parse(atob(base64));
    teacherName.value = payload.username || ''
    teacherClass.value = payload.className || ''
  } catch {}
}

const formatDate = (dateNum: number) => {
  const s = dateNum.toString()
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`
}

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0')
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`
}

// Builds the &from=&to= query fragment for the analytics endpoints (omits empties).
const rangeQuery = (from: string, to: string) => {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const s = p.toString()
  return s ? `&${s}` : ''
}

const severityClass = (n: number) => {
  if (n <= 2) return 'bg-green-100 text-green-700'
  if (n <= 5) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

const percentageClass = (p: number | null) => {
  if (p === null) return 'bg-gray-100 text-gray-500'
  if (p <= 20) return 'bg-green-100 text-green-700'
  if (p <= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

// ─── Behavior grade ──────────────────────────────────────────────────────────

interface BehaviorGrade {
  label: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
}

function behaviorGrade(hours: number): BehaviorGrade {
  if (hours <= 7)  return { label: 'Sehr Zufriedenstellend',   color: '#16a34a', bgClass: 'bg-green-100',  textClass: 'text-green-700',  borderClass: 'border-green-300' }
  if (hours <= 14) return { label: 'Zufriedenstellend',        color: '#65a30d', bgClass: 'bg-lime-100',   textClass: 'text-lime-700',   borderClass: 'border-lime-300' }
  if (hours <= 22) return { label: 'Wenig Zufriedenstellend',  color: '#ea580c', bgClass: 'bg-orange-100', textClass: 'text-orange-700', borderClass: 'border-orange-300' }
  return              { label: 'Nicht Zufriedenstellend',  color: '#dc2626', bgClass: 'bg-red-100',    textClass: 'text-red-700',    borderClass: 'border-red-300' }
}

const BEHAVIOR_TIERS = [
  { label: 'Sehr Zufriedenstellend',  range: '0–7 EH',   min: 0,  max: 7  },
  { label: 'Zufriedenstellend',       range: '8–14 EH',  min: 8,  max: 14 },
  { label: 'Wenig Zufriedenstellend', range: '15–22 EH', min: 15, max: 22 },
  { label: 'Nicht Zufriedenstellend', range: '≥ 23 EH',  min: 23, max: Infinity },
]

const behaviorMap = computed(() => {
  const m = new Map<number, BehaviorEntry>()
  for (const e of behaviorSummary.value) m.set(e.untisId, e)
  return m
})

// Sorted by unexcused hours descending — that's what drives the grade
const sortedBehavior = computed(() =>
  [...behaviorSummary.value].sort((a, b) => b.unexcusedHours - a.unexcusedHours),
)

const behaviorTierCounts = computed(() =>
  BEHAVIOR_TIERS.map((t) => ({
    ...t,
    count: behaviorSummary.value.filter((e) => e.unexcusedHours >= t.min && e.unexcusedHours <= t.max).length,
    grade: behaviorGrade(t.min),
  })),
)

// Sum of all-absences across the whole class (shown next to Zeitraum filter)
const classTotalHours = computed(() =>
  behaviorSummary.value.reduce((sum, e) => sum + e.totalHours, 0),
)

// ─── Chart builders ───────────────────────────────────────────────────────────
// The heatmap is the timetable-style grid in TimetableHeatmap.vue (fed directly
// with the heatmap cells). Only the pie chart still uses ApexCharts.

function buildPieSeries(stats: SubjectStat[]) {
  return {
    series: stats.map((s) => s.missedLessons),
    labels: stats.map((s) => s.subjectName),
  }
}

const pieOptions: ApexOptions = {
  chart: { type: 'pie', toolbar: { show: false } },
  legend: { position: 'bottom' },
  // Slice share = proportion of all missed lessons (spec Q8); tooltip shows the
  // absolute count behind each slice.
  tooltip: { y: { formatter: (v: number) => `${v} Fehlstunden` } },
  dataLabels: { formatter: (v: number) => `${Math.round(Number(v))}%` },
}

// ─── Computed chart data ──────────────────────────────────────────────────────

const studentPie = computed(() => buildPieSeries(analytics.value.stats))
const classPie = computed(() => buildPieSeries(classAnalytics.value.stats))

// ─── Data fetching ────────────────────────────────────────────────────────────

const fetchStudents = async () => {
  const token = getToken()
  if (!token) return
  decodeToken(token)
  loadingStudents.value = true
  error.value = ''
  try {
    const res = await fetch('/api/teacher/students', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      if (res.status === 401) { localStorage.removeItem('untis_jwt'); router.push('/'); return }
      throw new Error(`Fehler (${res.status})`)
    }
    students.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Schüler'
  } finally {
    loadingStudents.value = false
  }
}

const selectStudent = async (student: Student) => {
  selectedStudent.value = student
  absences.value = []
  totalHours.value = 0
  unexcusedHours.value = 0
  analytics.value = { stats: [], heatmap: [], totalHours: 0, unexcusedHours: 0 }
  analyticsFrom.value = ''
  analyticsTo.value = ''
  showAnalytics.value = false
  showClassAnalytics.value = false
  const token = getToken()
  if (!token) return
  loadingAbsences.value = true
  try {
    const res = await fetch(`/api/teacher/students/${student.untisId}/absences`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Fehler (${res.status})`)
    const data = await res.json()
    absences.value = data.absences
    totalHours.value = data.totalHours
    unexcusedHours.value = data.unexcusedHours
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Absenzen'
  } finally {
    loadingAbsences.value = false
  }
}

const fetchAnalytics = async () => {
  if (!selectedStudent.value) return
  const token = getToken()
  if (!token) return
  loadingAnalytics.value = true
  try {
    const res = await fetch(
      `/api/teacher/students/${selectedStudent.value.untisId}/analytics?mode=${analyticsMode.value}${rangeQuery(analyticsFrom.value, analyticsTo.value)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`Fehler (${res.status})`)
    analytics.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Analyse'
  } finally {
    loadingAnalytics.value = false
  }
}

const fetchClassAnalytics = async () => {
  const token = getToken()
  if (!token) return
  loadingClassAnalytics.value = true
  try {
    const res = await fetch(`/api/teacher/class/analytics?mode=all${rangeQuery(classFrom.value, classTo.value)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Fehler (${res.status})`)
    classAnalytics.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Klassen-Analyse'
  } finally {
    loadingClassAnalytics.value = false
  }
}

const toggleAnalytics = () => {
  showAnalytics.value = !showAnalytics.value
  if (showAnalytics.value) fetchAnalytics()
}

const setAnalyticsMode = (mode: 'open' | 'all') => {
  analyticsMode.value = mode
  fetchAnalytics()
}

const toggleClassAnalytics = () => {
  showClassAnalytics.value = true
  selectedStudent.value = null
  fetchClassAnalytics()
}

const clearAnalyticsRange = () => {
  analyticsFrom.value = ''
  analyticsTo.value = ''
  fetchAnalytics()
}

const clearClassRange = () => {
  classFrom.value = ''
  classTo.value = ''
  fetchClassAnalytics()
}

const viewAttachments = async (absence: Absence) => {
  activeExcuseMessage.value = absence.excuseMessage || ''
  activeAttachments.value = []
  showAttachmentModal.value = true
  const token = getToken()
  if (!token) return
  loadingAttachments.value = true
  try {
    const res = await fetch(`/api/absences/${absence.id}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) activeAttachments.value = await res.json()
  } catch (e) {
    console.error(e)
  } finally {
    loadingAttachments.value = false
  }
}

const closeAttachmentModal = () => {
  showAttachmentModal.value = false
  activeAttachments.value = []
  activeExcuseMessage.value = ''
}

const logout = () => {
  localStorage.removeItem('untis_jwt')
  router.push('/')
}

const activeAbsences = computed(() => absences.value.filter((a) => a.status === 'signed'))

const fetchBehaviorSummary = async () => {
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch('/api/teacher/class/behavior', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) behaviorSummary.value = await res.json()
  } catch {}
}

onMounted(() => { fetchStudents(); fetchBehaviorSummary() })
</script>

<template>
  <div class="h-screen w-full flex bg-[#f4f5f7] overflow-hidden font-sans">

    <!-- Left Sidebar: Navigation & Student List -->
    <aside class="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full z-10 shadow-sm relative">
      <!-- Sidebar Header -->
      <div class="h-16 flex items-center px-6 border-b border-gray-200 bg-white">
        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Klasse <span class="text-primary">{{ teacherClass }}</span></h1>
      </div>

      <!-- Class analytics entry + student count -->
      <div class="px-4 py-3 border-b border-gray-200">
        <button
          @click="toggleClassAnalytics"
          :class="[
            'w-full flex items-center justify-between px-4 py-2.5 rounded text-sm font-semibold transition-colors outline-none',
            showClassAnalytics
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-gray-700 hover:bg-gray-50 border border-gray-200'
          ]"
        >
          <span class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13h4v8H3v-8zm7-6h4v14h-4V7zm7-4h4v18h-4V3z"/></svg>
            Klassen-Analyse
          </span>
          <span class="text-xs font-bold text-gray-400">{{ students.length }} Schüler</span>
        </button>
      </div>

      <!-- Student List -->
      <div class="flex-1 overflow-y-auto w-full">
        <div v-if="loadingStudents" class="flex p-8 justify-center">
          <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
        </div>
        <div v-else-if="students.length === 0" class="p-8 text-center text-sm text-gray-400">
          Keine Schüler
        </div>
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="student in students" :key="student.untisId">
            <button
              @click="selectStudent(student)"
              :class="[
                'w-full flex items-center px-6 py-3 text-left transition-colors outline-none',
                selectedStudent?.untisId === student.untisId
                  ? 'bg-primary/10 border-r-4 border-primary'
                  : 'hover:bg-gray-50 border-r-4 border-transparent'
              ]"
            >
              <div class="flex-1 min-w-0">
                <p :class="['text-sm font-semibold truncate', selectedStudent?.untisId === student.untisId ? 'text-primary' : 'text-gray-900']">
                  {{ student.lastName }}, {{ student.firstName }}
                </p>
              </div>
              <!-- Behavior indicator: unexcused hours + grade color dot -->
              <div v-if="behaviorMap.has(student.untisId)" class="flex items-center gap-1 ml-2 flex-shrink-0">
                <span
                  class="text-[11px] font-bold tabular-nums"
                  :style="{ color: behaviorGrade(behaviorMap.get(student.untisId)!.unexcusedHours).color }"
                  :title="`${behaviorGrade(behaviorMap.get(student.untisId)!.unexcusedHours).label} · ${behaviorMap.get(student.untisId)!.unexcusedHours} unentschuldigte EH`"
                >{{ behaviorMap.get(student.untisId)!.unexcusedHours }}</span>
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  :style="{ background: behaviorGrade(behaviorMap.get(student.untisId)!.unexcusedHours).color }"
                ></span>
              </div>
              <svg class="h-4 w-4 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-if="selectedStudent?.untisId === student.untisId">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      </div>

      <!-- Sidebar Footer (Logout) -->
      <div class="p-4 border-t border-gray-200 bg-white">
        <div class="flex items-center mb-3 px-2">
          <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-3 flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <div class="text-sm font-semibold text-gray-700 truncate">{{ teacherName }}</div>
        </div>
        <button @click="logout" class="w-full flex items-center justify-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded border border-gray-200 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span>Abmelden</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col h-full bg-[#f4f5f7] overflow-hidden">
      <!-- Top navbar -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0 shadow-sm">
        <div class="flex items-center text-sm text-gray-500">
          <span>Lehrer-Dashboard</span>
          <span class="mx-2 text-gray-300">/</span>
          <span v-if="selectedStudent" class="font-semibold text-gray-900">
            {{ selectedStudent.firstName }} {{ selectedStudent.lastName }}
          </span>
          <span v-else-if="showClassAnalytics" class="font-semibold text-gray-900">
            Klassenanalyse
          </span>
          <span v-else>Bitte Schüler auswählen</span>
        </div>
        <div v-if="error" class="text-sm font-semibold text-red-600 truncate max-w-xs">{{ error }}</div>
      </header>

      <!-- Scrollable content -->
      <div class="flex-1 p-8 flex flex-col min-h-0 relative">

        <!-- ── Class Analytics ─────────────────────────────────────────── -->
        <div v-if="showClassAnalytics" class="flex-grow flex flex-col min-h-0 w-full">
          <div class="flex items-center justify-between mb-6 flex-shrink-0 flex-wrap gap-3">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">Klassenanalyse</h2>
              <p class="text-sm text-gray-500 mt-0.5">
                Basierend auf {{ students.length }} eingeloggten Schüler{{ students.length !== 1 ? 'n' : '' }}
              </p>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 px-3 py-1.5 rounded border border-primary/20">
              Alle Absenzen
            </span>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
            <!-- Zeitraum filter (applies to the whole analysis below) -->
            <div class="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap text-sm flex-shrink-0">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zeitraum:</span>
              <label class="flex items-center gap-1.5"><span class="text-gray-500">Von</span>
                <input type="date" v-model="classFrom" :max="classTo || undefined" @change="fetchClassAnalytics"
                  class="border border-gray-300 rounded px-2 py-1 text-sm" /></label>
              <span class="text-gray-400">–</span>
              <label class="flex items-center gap-1.5"><span class="text-gray-500">Bis</span>
                <input type="date" v-model="classTo" :min="classFrom || undefined" @change="fetchClassAnalytics"
                  class="border border-gray-300 rounded px-2 py-1 text-sm" /></label>
              <button v-if="classFrom || classTo" @click="clearClassRange"
                class="text-xs text-gray-500 hover:text-gray-800 underline">Zurücksetzen</button>
            </div>

            <div v-if="loadingClassAnalytics" class="p-12 flex-grow flex items-center justify-center">
              <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
            </div>
            <div v-else-if="classAnalytics.stats.length === 0" class="p-12 flex-grow flex flex-col items-center justify-center text-center">
              <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
              <p class="text-gray-500 text-sm font-medium">Noch keine Absenzen für diese Klasse erfasst.</p>
            </div>
            <div v-else class="flex-grow overflow-y-auto min-h-0 p-6">

              <!-- Heatmap + Pie -->
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                <div class="border border-gray-200 rounded-lg p-4">
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stundenplan-Heatmap</h3>
                  <TimetableHeatmap :cells="classAnalytics.heatmap" />
                </div>
                <div class="border border-gray-200 rounded-lg p-4">
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Versäumte Stunden nach Fach</h3>
                  <VueApexCharts type="pie" height="320" :options="{ ...pieOptions, labels: classPie.labels }" :series="classPie.series" />
                </div>
              </div>

              <!-- Fach-Übersicht -->
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fach-Übersicht</h3>
              <table class="w-full text-sm text-left border-collapse mb-8">
                <thead class="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th class="px-6 py-3 font-semibold">Fach</th>
                    <th class="px-6 py-3 font-semibold">Bezeichnung</th>
                    <th class="px-6 py-3 font-semibold text-right">Versäumt</th>
                    <th class="px-6 py-3 font-semibold text-right">Gesamt</th>
                    <th class="px-6 py-3 font-semibold text-right">%</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="s in classAnalytics.stats" :key="s.subjectName" class="hover:bg-gray-50/50">
                    <td class="px-6 py-3">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded font-bold text-white text-xs"
                        :style="{ background: subjectColor(s.subjectName) }"
                      >{{ s.subjectName }}</span>
                    </td>
                    <td class="px-6 py-3 text-gray-600">{{ s.subjectLongName || '—' }}</td>
                    <td class="px-6 py-3 text-right">
                      <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold', severityClass(s.missedLessons)]">{{ s.missedLessons }}</span>
                    </td>
                    <td class="px-6 py-3 text-right text-gray-500">{{ s.totalLessons ?? '—' }}</td>
                    <td class="px-6 py-3 text-right">
                      <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold', percentageClass(s.percentage)]">{{ s.percentage !== null ? s.percentage + '%' : '—' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Top-3 per student -->
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top-3 Fächer pro Schüler</h3>
              <table class="w-full text-sm text-left border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th class="px-6 py-3 font-semibold">Schüler</th>
                    <th class="px-6 py-3 font-semibold">Platz 1</th>
                    <th class="px-6 py-3 font-semibold">Platz 2</th>
                    <th class="px-6 py-3 font-semibold">Platz 3</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="row in classAnalytics.studentTable" :key="row.untisId" class="hover:bg-gray-50/50">
                    <td class="px-6 py-3 font-semibold text-gray-900">{{ row.lastName }}, {{ row.firstName }}</td>
                    <td v-for="i in 3" :key="i" class="px-6 py-3">
                      <template v-if="row.top3[i - 1]">
                        <span class="inline-flex items-center gap-1.5">
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded font-bold text-white text-xs"
                            :style="{ background: subjectColor(row.top3[i - 1]!.subjectName) }"
                          >{{ row.top3[i - 1]!.subjectName }}</span>
                          <span class="text-gray-400 text-xs">{{ row.top3[i - 1]!.percentage !== null ? row.top3[i - 1]!.percentage + '%' : row.top3[i - 1]!.missedLessons + '×' }}</span>
                        </span>
                      </template>
                      <span v-else class="text-gray-300">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── No selection ────────────────────────────────────────────── -->
        <div v-else-if="!selectedStudent" class="flex-grow flex flex-col items-center justify-center opacity-50">
          <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p class="text-gray-500 text-lg">Wählen Sie einen Schüler links aus</p>
        </div>

        <!-- ── Student selected ────────────────────────────────────────── -->
        <div v-else class="flex-grow flex flex-col min-h-0 w-full">
          <!-- Toolbar -->
          <div class="flex items-center justify-between mb-6 flex-shrink-0 flex-wrap gap-3">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ showAnalytics ? 'Analyse' : 'Unterschriebene Entschuldigungen' }}
            </h2>
            <div class="flex items-center gap-3 flex-wrap">
              <!-- Open/All toggle (analytics only) -->
              <div v-if="showAnalytics" class="flex space-x-2 bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                <button @click="setAnalyticsMode('open')" :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', analyticsMode === 'open' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']">Offen</button>
                <button @click="setAnalyticsMode('all')" :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', analyticsMode === 'all' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']">Alle</button>
              </div>
              <!-- Liste/Analyse toggle -->
              <div class="flex space-x-2 bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                <button @click="showAnalytics = false" :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', !showAnalytics ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']">Liste</button>
                <button @click="toggleAnalytics" :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', showAnalytics ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']">Analyse</button>
              </div>
            </div>
          </div>

          <!-- Stat cards: all-time totals for the selected student -->
          <div class="flex items-center gap-4 mb-6 flex-shrink-0 flex-wrap">
            <div class="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm">
              <div class="flex flex-col">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fehlstunden gesamt</span>
                <span class="text-3xl font-black text-gray-900 tabular-nums leading-tight">{{ totalHours }}</span>
              </div>
              <span class="text-sm text-gray-400 font-semibold self-end pb-0.5">EH</span>
            </div>
            <div class="flex items-center gap-3 bg-white border border-red-200 rounded-lg px-5 py-3 shadow-sm">
              <div class="flex flex-col">
                <span class="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Nicht entschuldigt</span>
                <span class="text-3xl font-black text-red-600 tabular-nums leading-tight">{{ unexcusedHours }}</span>
              </div>
              <span class="text-sm text-red-400 font-semibold self-end pb-0.5">EH</span>
            </div>
          </div>

          <!-- Content card -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
            <!-- Analytics -->
            <div v-if="showAnalytics" class="flex-1 flex flex-col min-h-0">
              <!-- Summary Bar (Total Hours + Behavior Grade) — all values respect the active date filter -->
              <div class="px-6 py-3 bg-slate-50 border-b border-gray-200 flex items-center gap-6 flex-shrink-0 text-sm flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gesamte Fehlstunden:</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20">
                    {{ analytics.totalHours }} EH
                  </span>
                </div>
                <div class="h-4 w-px bg-gray-200"></div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Davon unentschuldigt:</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold bg-red-100 text-red-700 border border-red-200">
                    {{ analytics.unexcusedHours }} EH
                  </span>
                </div>
                <div class="h-4 w-px bg-gray-200"></div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verhaltensnote:</span>
                  <span
                    :class="['inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold border text-xs',
                      behaviorGrade(analytics.unexcusedHours).bgClass,
                      behaviorGrade(analytics.unexcusedHours).textClass,
                      behaviorGrade(analytics.unexcusedHours).borderClass]"
                  >
                    <span class="w-2 h-2 rounded-full flex-shrink-0"
                      :style="{ background: behaviorGrade(analytics.unexcusedHours).color }"
                    ></span>
                    {{ behaviorGrade(analytics.unexcusedHours).label }}
                  </span>
                </div>
              </div>

              <!-- Zeitraum filter (applies to the whole analysis below) -->
              <div class="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap text-sm flex-shrink-0">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zeitraum:</span>
                <label class="flex items-center gap-1.5"><span class="text-gray-500">Von</span>
                  <input type="date" v-model="analyticsFrom" :max="analyticsTo || undefined" @change="fetchAnalytics"
                    class="border border-gray-300 rounded px-2 py-1 text-sm" /></label>
                <span class="text-gray-400">–</span>
                <label class="flex items-center gap-1.5"><span class="text-gray-500">Bis</span>
                  <input type="date" v-model="analyticsTo" :min="analyticsFrom || undefined" @change="fetchAnalytics"
                    class="border border-gray-300 rounded px-2 py-1 text-sm" /></label>
                <button v-if="analyticsFrom || analyticsTo" @click="clearAnalyticsRange"
                  class="text-xs text-gray-500 hover:text-gray-800 underline">Zurücksetzen</button>
              </div>

              <div v-if="loadingAnalytics" class="p-12 flex-grow flex items-center justify-center bg-white">
                <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
              </div>
              <div v-else-if="analytics.stats.length === 0" class="p-12 flex-grow flex flex-col items-center justify-center text-center">
                <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <p class="text-gray-500 text-sm font-medium">Keine Fehlstunden in der Analyse vorhanden.</p>
              </div>
              <div v-else class="flex-grow overflow-y-auto min-h-0 p-6">
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stundenplan-Heatmap</h3>
                    <TimetableHeatmap :cells="analytics.heatmap" />
                  </div>
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Versäumte Stunden nach Fach</h3>
                    <VueApexCharts type="pie" height="320" :options="{ ...pieOptions, labels: studentPie.labels }" :series="studentPie.series" />
                  </div>
                </div>
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fach-Detail</h3>
                <table class="w-full text-sm text-left border-collapse">
                  <thead class="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th class="px-6 py-3 font-semibold">Fach</th>
                      <th class="px-6 py-3 font-semibold">Bezeichnung</th>
                      <th class="px-6 py-3 font-semibold text-right">Versäumt</th>
                      <th class="px-6 py-3 font-semibold text-right">Gesamt</th>
                      <th class="px-6 py-3 font-semibold text-right">%</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="s in analytics.stats" :key="s.subjectName" class="hover:bg-gray-50/50">
                      <td class="px-6 py-3">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded font-bold text-white text-xs"
                          :style="{ background: subjectColor(s.subjectName) }"
                        >{{ s.subjectName }}</span>
                      </td>
                      <td class="px-6 py-3 text-gray-600">{{ s.subjectLongName || '—' }}</td>
                      <td class="px-6 py-3 text-right"><span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold', severityClass(s.missedLessons)]">{{ s.missedLessons }}</span></td>
                      <td class="px-6 py-3 text-right text-gray-500">{{ s.totalLessons ?? '—' }}</td>
                      <td class="px-6 py-3 text-right"><span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold', percentageClass(s.percentage)]">{{ s.percentage !== null ? s.percentage + '%' : '—' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- List -->
            <div v-else class="flex-1 flex flex-col min-h-0 bg-slate-50">
              <div v-if="loadingAbsences" class="p-12 flex-grow flex items-center justify-center bg-white">
                <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
              </div>
              <div v-else class="flex-grow flex flex-col min-h-0">
                <!-- Summary Bar (Total Hours) -->
                <div class="px-6 py-3 bg-slate-50 border-b border-gray-200 flex items-center gap-6 flex-shrink-0 text-sm">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gesamte Fehlstunden:</span>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20">
                      {{ totalHours }} EH
                    </span>
                  </div>
                  <div class="h-4 w-px bg-gray-200"></div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-gray-550 uppercase tracking-wider">Davon unentschuldigt:</span>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold bg-red-100 text-red-700 border border-red-200">
                      {{ unexcusedHours }} EH
                    </span>
                  </div>
                </div>

                <div v-if="activeAbsences.length === 0" class="p-12 flex-grow flex flex-col items-center justify-center bg-white">
                  <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <p class="text-gray-500 text-sm font-medium">Alle Absenzen wurden bearbeitet.</p>
                </div>
                <div v-else class="flex-grow overflow-y-auto min-h-0 bg-white">
                  <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 z-10">
                      <tr>
                        <th class="px-6 py-3 font-semibold">Datum</th>
                        <th class="px-6 py-3 font-semibold">Von</th>
                        <th class="px-6 py-3 font-semibold">Bis</th>
                        <th class="px-6 py-3 font-semibold text-center">Status</th>
                        <th class="px-6 py-3 font-semibold text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                      <tr v-for="absence in activeAbsences" :key="absence.id" class="hover:bg-gray-50/50">
                        <td class="px-6 py-4 font-semibold text-gray-900">{{ formatDate(absence.date) }}</td>
                        <td class="px-6 py-4 text-gray-600">{{ formatTime(absence.startTime) }} Uhr</td>
                        <td class="px-6 py-4 text-gray-600">{{ formatTime(absence.endTime) }} Uhr</td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-semibold border border-green-200">Unterschrieben</span>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <button @click="viewAttachments(absence)" class="text-primary hover:text-orange-700 font-semibold cursor-pointer underline-offset-2 hover:underline">Ansehen</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Details Modal -->
    <div v-if="showAttachmentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4" @click.self="closeAttachmentModal">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-xl flex flex-col max-h-[90vh] border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-lg">
          <h3 class="font-bold text-gray-900">Details</h3>
          <button @click="closeAttachmentModal" class="text-gray-400 hover:text-gray-900 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <div class="mb-6">
            <label class="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Begründung</label>
            <div class="bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-800 break-words whitespace-pre-wrap">
              {{ activeExcuseMessage || 'Keine Begründung eingegeben' }}
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Anhänge</label>
            <div v-if="loadingAttachments" class="text-sm text-gray-500">Laden...</div>
            <div v-else-if="activeAttachments.length === 0" class="text-sm text-gray-400 italic">Keine Anhänge</div>
            <div v-else class="space-y-4">
              <div v-for="(file, i) in activeAttachments" :key="i" class="border border-gray-200 rounded overflow-hidden">
                <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-600">{{ file.fileName }}</div>
                <div class="p-2">
                  <img v-if="file.fileData.startsWith('data:image')" :src="file.fileData" class="w-full h-auto mx-auto object-contain max-h-64" alt="Anhang" />
                  <iframe v-else-if="file.fileData.startsWith('data:application/pdf')" :src="file.fileData" class="w-full h-64 border-0"></iframe>
                  <div v-else class="p-4 text-sm text-gray-500 text-center">Format wird nicht unterstützt.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-lg flex justify-end">
          <button @click="closeAttachmentModal" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-semibold transition-colors shadow-sm">
            Schließen
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
