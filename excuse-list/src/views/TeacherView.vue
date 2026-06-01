<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import TimetableHeatmap from '@/components/TimetableHeatmap.vue'

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

interface AnalyticsPayload {
  stats: SubjectStat[]
  heatmap: HeatmapCell[]
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

// Student analytics
const showAnalytics = ref(false)
const analyticsMode = ref<'open' | 'all'>('open')
const analytics = ref<AnalyticsPayload>({ stats: [], heatmap: [] })
const loadingAnalytics = ref(false)

// Class analytics — always over all absences (no open/all toggle).
const showClassAnalytics = ref(false)
const classAnalytics = ref<ClassAnalyticsPayload>({ stats: [], heatmap: [], studentTable: [] })
const loadingClassAnalytics = ref(false)

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
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
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
  analytics.value = { stats: [], heatmap: [] }
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
    absences.value = await res.json()
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
      `/api/teacher/students/${selectedStudent.value.untisId}/analytics?mode=${analyticsMode.value}`,
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
    const res = await fetch(`/api/teacher/class/analytics?mode=all`, {
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

onMounted(fetchStudents)
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">

      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">Lehrer-Dashboard</h1>
          <p class="text-gray-500 text-sm mt-1">
            Klasse <span class="font-bold text-blue-600">{{ teacherClass }}</span>
          </p>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="toggleClassAnalytics"
            :class="[
              'px-5 py-3 rounded-xl font-bold uppercase text-sm transition',
              showClassAnalytics ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
            ]"
          >
            Klassen-Analyse
          </button>

          <div class="bg-white rounded-xl px-6 py-3 shadow-sm border border-gray-200 text-right">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Schüler</div>
            <div class="text-2xl font-black text-blue-600">{{ students.length }}</div>
          </div>

          <button
            @click="logout"
            class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-5 py-3 rounded-xl font-bold uppercase text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Error Banner -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
        <p class="text-sm font-bold text-red-700">{{ error }}</p>
      </div>

      <!-- Split Layout -->
      <div class="flex gap-6 min-h-[70vh]">

        <!-- Left: Student List -->
        <div class="w-72 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Schüler — {{ teacherClass }}
            </h2>
          </div>
          <div v-if="loadingStudents" class="flex-1 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="students.length === 0" class="flex-1 flex items-center justify-center px-4 text-center">
            <p class="text-sm text-gray-400">Keine Schüler gefunden.</p>
          </div>
          <div v-else class="flex-1 overflow-y-auto divide-y divide-gray-50">
            <button
              v-for="student in students"
              :key="student.untisId"
              @click="selectStudent(student)"
              :class="[
                'w-full text-left px-5 py-4 transition flex items-center gap-3',
                selectedStudent?.untisId === student.untisId
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-50 text-gray-900',
              ]"
            >
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                  selectedStudent?.untisId === student.untisId ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600',
                ]"
              >
                {{ student.firstName[0] }}{{ student.lastName[0] }}
              </div>
              <div class="min-w-0">
                <div class="font-bold text-sm truncate">{{ student.lastName }}</div>
                <div :class="['text-xs truncate', selectedStudent?.untisId === student.untisId ? 'text-blue-200' : 'text-gray-400']">
                  {{ student.firstName }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Right Panel -->
        <div class="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">

          <!-- ── Class Analytics ─────────────────────────────────────────── -->
          <template v-if="showClassAnalytics">
            <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 class="text-xl font-black text-gray-900">Klassen-Analyse</h2>
                <p class="text-xs text-gray-400 mt-0.5 uppercase tracking-wide font-bold">{{ teacherClass }}</p>
                <p class="text-[11px] text-gray-400 mt-0.5 normal-case">
                  Basierend auf {{ students.length }} eingeloggten Schüler{{ students.length !== 1 ? 'n' : '' }}
                </p>
              </div>
              <span class="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                Alle Absenzen
              </span>
            </div>

            <div class="flex-1 overflow-auto p-6">
              <div v-if="loadingClassAnalytics" class="h-40 flex items-center justify-center">
                <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="classAnalytics.stats.length === 0" class="h-40 flex flex-col items-center justify-center text-center">
                <div class="text-4xl mb-3">📊</div>
                <h3 class="text-lg font-bold text-gray-900">Keine Daten</h3>
                <p class="text-sm text-gray-400 mt-1">Es wurden noch keine Absenzen für diese Klasse erfasst.</p>
              </div>
              <template v-else>
                <!-- Heatmap + Pie side by side -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                  <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Stundenplan-Heatmap</h3>
                    <TimetableHeatmap :cells="classAnalytics.heatmap" />
                  </div>
                  <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Versäumte Stunden nach Fach</h3>
                    <VueApexCharts
                      type="pie"
                      height="340"
                      :options="{ ...pieOptions, labels: classPie.labels }"
                      :series="classPie.series"
                    />
                  </div>
                </div>

                <!-- Subject stats table -->
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fach-Übersicht</h3>
                <table class="w-full mb-8">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Fach</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bezeichnung</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Versäumt</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Gesamt</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">%</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="s in classAnalytics.stats" :key="s.subjectName" class="hover:bg-gray-50 transition">
                      <td class="px-4 py-3 text-sm font-bold text-gray-900">{{ s.subjectName }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ s.subjectLongName || '—' }}</td>
                      <td class="px-4 py-3 text-right">
                        <span :class="['inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-black', severityClass(s.missedLessons)]">
                          {{ s.missedLessons }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right text-sm text-gray-500">{{ s.totalLessons ?? '—' }}</td>
                      <td class="px-4 py-3 text-right">
                        <span :class="['inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-black', percentageClass(s.percentage)]">
                          {{ s.percentage !== null ? s.percentage + '%' : '—' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Per-student top 3 table -->
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Top-3 Fächer pro Schüler</h3>
                <table class="w-full">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Schüler</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Platz 1</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Platz 2</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Platz 3</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="row in classAnalytics.studentTable" :key="row.untisId" class="hover:bg-gray-50 transition">
                      <td class="px-4 py-3 text-sm font-bold text-gray-900">{{ row.lastName }}, {{ row.firstName }}</td>
                      <td v-for="i in 3" :key="i" class="px-4 py-3 text-sm">
                        <template v-if="row.top3[i - 1]">
                          <span class="font-bold text-gray-800">{{ row.top3[i - 1]!.subjectName }}</span>
                          <span class="text-gray-400 ml-1 text-xs">
                            {{ row.top3[i - 1]!.percentage !== null ? row.top3[i - 1]!.percentage + '%' : row.top3[i - 1]!.missedLessons + 'x' }}
                          </span>
                        </template>
                        <span v-else class="text-gray-300">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </div>
          </template>

          <!-- ── No student selected ────────────────────────────────────── -->
          <div v-else-if="!selectedStudent" class="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900">Schüler auswählen</h3>
            <p class="text-gray-400 text-sm mt-2">Klicken Sie links auf einen Schüler, um seine Absenzen zu sehen.</p>
          </div>

          <!-- ── Student selected ────────────────────────────────────────── -->
          <template v-else>
            <!-- Panel Header -->
            <div class="px-6 py-5 border-b border-gray-100 flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 class="text-xl font-black text-gray-900">
                  {{ selectedStudent.firstName }} {{ selectedStudent.lastName }}
                </h2>
                <p class="text-xs text-gray-400 mt-0.5 uppercase tracking-wide font-bold">
                  {{ showAnalytics ? 'Analyse' : 'Unterschriebene Entschuldigungen' }}
                </p>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <!-- Open/All toggle (only in analytics mode) -->
                <div v-if="showAnalytics" class="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    @click="setAnalyticsMode('open')"
                    :class="['px-4 py-1.5 rounded-md text-xs font-bold uppercase transition', analyticsMode === 'open' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700']"
                  >Offen</button>
                  <button
                    @click="setAnalyticsMode('all')"
                    :class="['px-4 py-1.5 rounded-md text-xs font-bold uppercase transition', analyticsMode === 'all' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700']"
                  >Alle</button>
                </div>
                <!-- Analyse / Absenzen toggle -->
                <button
                  @click="toggleAnalytics"
                  :class="[
                    'px-4 py-2 rounded-lg font-bold uppercase text-xs transition',
                    showAnalytics ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
                  ]"
                >
                  {{ showAnalytics ? 'Absenzen' : 'Analyse' }}
                </button>
                <span v-if="!showAnalytics" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {{ activeAbsences.length }} Eintrag{{ activeAbsences.length !== 1 ? 'e' : '' }}
                </span>
              </div>
            </div>

            <!-- ── Student Analytics ──────────────────────────────────────── -->
            <div v-if="showAnalytics" class="flex-1 overflow-auto p-6">
              <div v-if="loadingAnalytics" class="h-40 flex items-center justify-center">
                <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="analytics.stats.length === 0" class="h-40 flex flex-col items-center justify-center text-center">
                <div class="text-4xl mb-3">📊</div>
                <h3 class="text-lg font-bold text-gray-900">Keine Daten</h3>
                <p class="text-sm text-gray-400 mt-1">Für diesen Schüler wurden noch keine Stunden-Absenzen erfasst.</p>
              </div>
              <template v-else>
                <!-- Heatmap + Pie -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                  <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Stundenplan-Heatmap</h3>
                    <TimetableHeatmap :cells="analytics.heatmap" />
                  </div>
                  <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Versäumte Stunden nach Fach</h3>
                    <VueApexCharts
                      type="pie"
                      height="340"
                      :options="{ ...pieOptions, labels: studentPie.labels }"
                      :series="studentPie.series"
                    />
                  </div>
                </div>

                <!-- Detail table -->
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fach-Detail</h3>
                <table class="w-full">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Fach</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bezeichnung</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Versäumt</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Gesamt</th>
                      <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">%</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="s in analytics.stats" :key="s.subjectName" class="hover:bg-gray-50 transition">
                      <td class="px-4 py-3 text-sm font-bold text-gray-900">{{ s.subjectName }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ s.subjectLongName || '—' }}</td>
                      <td class="px-4 py-3 text-right">
                        <span :class="['inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-black', severityClass(s.missedLessons)]">
                          {{ s.missedLessons }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right text-sm text-gray-500">{{ s.totalLessons ?? '—' }}</td>
                      <td class="px-4 py-3 text-right">
                        <span :class="['inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-black', percentageClass(s.percentage)]">
                          {{ s.percentage !== null ? s.percentage + '%' : '—' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </div>

            <!-- ── Absences list ──────────────────────────────────────────── -->
            <template v-else>
              <div v-if="loadingAbsences" class="flex-1 flex items-center justify-center">
                <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="activeAbsences.length === 0" class="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div class="text-4xl mb-4">✓</div>
                <h3 class="text-lg font-bold text-gray-900">Keine Einträge</h3>
                <p class="text-sm text-gray-400 mt-1">Es wurden keine entsprechenden Absenzen gefunden.</p>
              </div>
              <div v-else class="flex-1 overflow-auto">
                <table class="w-full">
                  <thead class="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Datum</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Von</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bis</th>
                      <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Details</th>
                      <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="absence in activeAbsences" :key="absence.id" class="hover:bg-gray-50 transition">
                      <td class="px-6 py-4 text-sm font-semibold text-gray-900">{{ formatDate(absence.date) }}</td>
                      <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.startTime) }}</td>
                      <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.endTime) }}</td>
                      <td class="px-6 py-4 text-center">
                        <button @click="viewAttachments(absence)" class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition">
                          Ansehen
                        </button>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <span class="inline-flex items-center gap-1.5 text-green-700 text-xs font-bold">
                          <span class="w-2 h-2 rounded-full bg-green-600"></span>
                          Unterschrieben
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </template>

        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div v-if="showAttachmentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeAttachmentModal">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <p class="font-bold text-gray-900">Entschuldigungs-Details</p>
          <button @click="closeAttachmentModal" class="text-gray-400 hover:text-gray-600 transition p-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-6 overflow-y-auto">
          <div class="mb-4">
            <h4 class="text-xs font-bold text-gray-500 uppercase mb-1">Nachricht / Begründung</h4>
            <p class="text-sm text-gray-800 bg-gray-50 p-4 rounded-xl border border-gray-100">
              {{ activeExcuseMessage || 'Keine Begründung angegeben' }}
            </p>
          </div>
          <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Anhänge</h4>
          <div v-if="loadingAttachments" class="text-sm text-gray-500">Lade Anhänge...</div>
          <div v-else-if="activeAttachments.length === 0" class="text-sm text-gray-500 italic">Keine Anhänge verfügbar.</div>
          <div v-else class="space-y-4">
            <div v-for="(file, i) in activeAttachments" :key="i" class="border border-gray-200 rounded-xl overflow-hidden p-2">
              <p class="text-xs font-bold text-gray-600 mb-2 px-2">{{ file.fileName }}</p>
              <img v-if="file.fileData.startsWith('data:image')" :src="file.fileData" class="w-full h-auto rounded-lg object-contain max-h-64" alt="Anhang" />
              <iframe v-else-if="file.fileData.startsWith('data:application/pdf')" :src="file.fileData" class="w-full h-64 rounded-lg"></iframe>
              <div v-else class="px-2 py-4 text-sm text-gray-500 italic">Format wird nicht unterstützt.</div>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100">
          <button @click="closeAttachmentModal" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-xl font-bold uppercase transition text-sm">Schließen</button>
        </div>
      </div>
    </div>

  </div>
</template>
