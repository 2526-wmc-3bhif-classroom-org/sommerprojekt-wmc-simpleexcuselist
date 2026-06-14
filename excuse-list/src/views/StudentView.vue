<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import LightingMode from '@/components/LightingMode.vue';

import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import TimetableHeatmap from '@/components/TimetableHeatmap.vue';

interface SubjectStat {
  subjectName: string;
  subjectLongName: string;
  missedLessons: number;
  totalLessons: number | null;
  percentage: number | null;
}

interface HeatmapCell {
  dayOfWeek: number;
  period: number;
  count: number;
  subjects?: string[];
}

interface AnalyticsPayload {
  stats: SubjectStat[];
  heatmap: HeatmapCell[];
}


interface Absence {
  id: string;
  untisId: number;
  date: number;
  startTime: number;
  endTime: number;
  isExcusedUntis: number;
  status: string;
}

const absences = ref<Absence[]>([]);
const loading = ref(true);
const error = ref('');
const router = useRouter();

// --- Filter State ---
const searchFilter = ref('');

// --- Modal/Drawer State ---
const showModal = ref(false);
const activeAbsence = ref<Absence | null>(null);
const excuseMessage = ref('');
const excuseMessageError = ref(false);
const excuseFiles = ref<File[]>([]);
const submitting = ref(false);
const submitSuccess = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const formatDate = (dateNum: number) => {
  if (!dateNum) return 'N/A';
  const s = dateNum.toString();
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`;
};

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0');
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`;
};

const fetchAbsences = async () => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/absences', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) { localStorage.removeItem('untis_jwt'); router.push('/'); return; }
      const errData = await response.json();
      throw new Error(errData.details || 'Failed to fetch absences');
    }
    absences.value = await response.json();
  } catch (err: any) {
    error.value = err.message || 'An error occurred';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchAbsences);

const logout = () => {
  localStorage.removeItem('untis_jwt');
  router.push('/');
};

// Absences not yet excused in WebUntis — the ones still needing action.
const openAbsenceCount = computed(
  () => absences.value.filter((a) => !a.isExcusedUntis).length,
);

// --- Filtered Absences ---
const filteredAbsences = computed(() => {
  if (!searchFilter.value) return absences.value;
  const term = searchFilter.value.trim().toLowerCase();
  return absences.value.filter(a => {
    const dateStr = formatDate(a.date);
    const timeStr = `${formatTime(a.startTime)} - ${formatTime(a.endTime)}`;
    return dateStr.toLowerCase().includes(term) || timeStr.toLowerCase().includes(term);
  });
});

// --- Modal/Drawer Logic ---
const openModal = (absence: Absence) => {
  activeAbsence.value = absence;
  excuseMessage.value = '';
  excuseMessageError.value = false;
  excuseFiles.value = [];
  submitSuccess.value = false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  activeAbsence.value = null;
};

// Mirrors the server-side limits in validateAttachments (excuseRepository.ts).
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const addFiles = (files: File[]) => {
  for (const f of files) {
    if (!ALLOWED_FILE_TYPES.includes(f.type)) {
      alert(`„${f.name}" wird nicht unterstützt. Nur PDF, JPEG und PNG sind erlaubt.`);
      continue;
    }
    if (f.size > MAX_FILE_BYTES) {
      alert(`„${f.name}" ist größer als 5 MB.`);
      continue;
    }
    if (excuseFiles.value.length >= MAX_FILES) {
      alert(`Maximal ${MAX_FILES} Dateien erlaubt.`);
      break;
    }
    excuseFiles.value.push(f);
  }
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) addFiles(Array.from(input.files));
  input.value = ''; // allow re-selecting the same file after removal
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files));
};

const removeFile = (index: number) => {
  excuseFiles.value.splice(index, 1);
};

const convertFileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

const submitExcuse = async () => {
  if (!activeAbsence.value) return;
  excuseMessageError.value = false;

  if (!excuseMessage.value.trim()) {
    excuseMessageError.value = true;
    return;
  }

  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }

  submitting.value = true;
  try {
    const attachments = await Promise.all(excuseFiles.value.map(async f => ({
      fileName: f.name,
      fileData: await convertFileToBase64(f)
    })));

    const res = await fetch('/api/excuses/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        absenceId: activeAbsence.value.id,
        message: excuseMessage.value,
        attachments
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Unbekannter Fehler');
    }

    submitSuccess.value = true;
    await fetchAbsences();
  } catch (err: any) {
    alert('Fehler beim Einreichen: ' + err.message);
  } finally {
    submitting.value = false;
  }
};

// --- Analytics State & Methods ---
const showAnalytics = ref(false);
const analyticsMode = ref<'open' | 'all'>('open');
const analytics = ref<AnalyticsPayload>({ stats: [], heatmap: [] });
const loadingAnalytics = ref(false);

const fetchAnalytics = async () => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }
  loadingAnalytics.value = true;
  try {
    const res = await fetch(`/api/student/analytics?mode=${analyticsMode.value}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Fehler beim Laden der Analyse (${res.status})`);
    analytics.value = await res.json();
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Analyse';
  } finally {
    loadingAnalytics.value = false;
  }
};

const toggleAnalytics = () => {
  showAnalytics.value = !showAnalytics.value;
  if (showAnalytics.value) fetchAnalytics();
};

const setAnalyticsMode = (mode: 'open' | 'all') => {
  analyticsMode.value = mode;
  fetchAnalytics();
};

function buildPieSeries(stats: SubjectStat[]) {
  return {
    series: stats.map((s) => s.missedLessons),
    labels: stats.map((s) => s.subjectName),
  };
}

const studentPie = computed(() => buildPieSeries(analytics.value.stats));

const pieOptions: ApexOptions = {
  chart: { type: 'pie', toolbar: { show: false } },
  legend: { position: 'bottom' },
  tooltip: { y: { formatter: (v: number) => `${v} Fehlstunden` } },
  dataLabels: { formatter: (v: number) => `${Math.round(Number(v))}%` },
};

const severityClass = (n: number) => {
  if (n <= 2) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
  if (n <= 5) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
  return 'bg-red-50 text-red-700 dark:bg-red-955/20 dark:text-red-400';
};

const percentageClass = (p: number | null) => {
  if (p === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  if (p <= 20) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
  if (p <= 40) return 'bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400';
  return 'bg-red-50 text-red-700 dark:bg-red-955/20 dark:text-red-400';
};
</script>


<template>
  <div class="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
    
    <!-- Top Navigation Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between px-6 py-4 transition-colors duration-300">
      <div class="flex items-center gap-3">
        <div class="bg-primary/10 text-primary p-2 rounded-xl font-bold tracking-widest text-xs uppercase dark:bg-primary/20">
          Excuses
        </div>
        <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Schüler-Dashboard</h1>
      </div>
      <div class="flex items-center gap-4">
        <!-- Theme Toggle -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg transition-colors">
          <LightingMode />
        </div>
        <button @click="logout" class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition text-sm font-bold">
          Abmelden
        </button>
      </div>
    </header>
    <main class="flex-1 w-full px-6 md:px-12 py-10 space-y-6">
      
      <!-- Dashboard Title Block -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {{ showAnalytics ? 'Analyse' : 'Meine Fehlstunden' }}
          </h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">
            <template v-if="!showAnalytics">
              Du hast aktuell <span class="font-bold text-primary">{{ openAbsenceCount }}</span> offene Fehlstunde{{ openAbsenceCount === 1 ? '' : 'n' }}.
            </template>
            <template v-else>
              Stundenplan- und Fachstatistiken deiner Abwesenheiten.
            </template>
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Open/All toggle (analytics only) -->
          <div v-if="showAnalytics" class="flex space-x-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm transition-colors duration-300">
            <button @click="setAnalyticsMode('open')" :class="['px-4 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors', analyticsMode === 'open' ? 'bg-slate-100 dark:bg-slate-805 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300']">Offen</button>
            <button @click="setAnalyticsMode('all')" :class="['px-4 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors', analyticsMode === 'all' ? 'bg-slate-100 dark:bg-slate-805 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300']">Alle</button>
          </div>
          <!-- List/Analytics toggle -->
          <div class="flex space-x-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm transition-colors duration-300">
            <button @click="showAnalytics = false" :class="['px-4 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors', !showAnalytics ? 'bg-slate-100 dark:bg-slate-805 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300']">Liste</button>
            <button @click="toggleAnalytics" :class="['px-4 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors', showAnalytics ? 'bg-slate-100 dark:bg-slate-805 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300']">Analyse</button>
          </div>
          <button v-if="!showAnalytics" @click="fetchAbsences" class="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2 text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
            <svg class="w-3.5 h-3.5 text-slate-450" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Aktualisieren
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="space-y-4">
        
        <!-- Analytics View -->
        <div v-if="showAnalytics" class="space-y-6">
          <div v-if="loadingAnalytics" class="flex justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 transition-colors duration-300">
            <div class="w-7 h-7 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
          <div v-else-if="analytics.stats.length === 0" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 p-10 flex flex-col items-center text-center transition-colors duration-300">
            <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mb-3 border border-emerald-100 dark:border-emerald-900/35 shadow-sm">
              <svg class="w-6 h-6 text-emerald-505" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-slate-955 dark:text-white tracking-tight">Keine Fehlstunden in der Analyse</h3>
            <p class="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs leading-relaxed">
              Für den ausgewählten Zeitraum bzw. Modus sind keine Fehlstunden erfasst.
            </p>
          </div>
          <div v-else class="space-y-6">
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <!-- Heatmap -->
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 rounded-2xl p-6 shadow-sm transition-colors overflow-hidden">
                <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Stundenplan-Heatmap</h3>
                <TimetableHeatmap :cells="analytics.heatmap" />
              </div>
              <!-- Pie Chart -->
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 rounded-2xl p-6 shadow-sm transition-colors flex flex-col overflow-hidden">
                <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Versäumte Stunden nach Fach</h3>
                <div class="flex-1 flex items-center justify-center min-h-[320px]">
                  <VueApexCharts class="w-full" type="pie" height="320" :options="{ ...pieOptions, labels: studentPie.labels }" :series="studentPie.series" />
                </div>
              </div>
            </div>

            <!-- Subject Detail Table -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm overflow-hidden transition-colors">
              <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Fach-Detail</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm text-left border-collapse">
                  <thead class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th class="px-6 py-3.5">Fach</th>
                      <th class="px-6 py-3.5">Bezeichnung</th>
                      <th class="px-6 py-3.5 text-right">Versäumt</th>
                      <th class="px-6 py-3.5 text-right">Gesamt</th>
                      <th class="px-6 py-3.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-850">
                    <tr v-for="s in analytics.stats" :key="s.subjectName" class="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                      <td class="px-6 py-3.5 font-bold text-slate-900 dark:text-white">{{ s.subjectName }}</td>
                      <td class="px-6 py-3.5 text-slate-600 dark:text-slate-400">{{ s.subjectLongName || '—' }}</td>
                      <td class="px-6 py-3.5 text-right">
                        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold', severityClass(s.missedLessons)]">
                          {{ s.missedLessons }}
                        </span>
                      </td>
                      <td class="px-6 py-3.5 text-right text-slate-500 dark:text-slate-400">{{ s.totalLessons ?? '—' }}</td>
                      <td class="px-6 py-3.5 text-right">
                        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold', percentageClass(s.percentage)]">
                          {{ s.percentage !== null ? s.percentage + '%' : '—' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <!-- List View -->

          <!-- Filter Bar -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 p-4 rounded-2xl shadow-sm transition-colors duration-300">
            <div class="relative w-full">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                v-model="searchFilter"
                type="text"
                placeholder="Nach Datum oder Uhrzeit filtern (z.B. 15.01...)"
                class="block w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all"
              />
            </div>
          </div>

          <div v-if="loading" class="flex justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 transition-colors duration-300">

          <div class="w-7 h-7 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        </div>

        <div v-else-if="error" class="p-6 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl">
          <h3 class="font-bold text-sm">Fehler beim Laden</h3>
          <p class="text-xs mt-1">{{ error }}</p>
        </div>

        <!-- Empty State Redesigned -->
        <div v-else-if="filteredAbsences.length === 0" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 p-10 flex flex-col items-center text-center transition-colors duration-300">
          <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mb-3 border border-emerald-100 dark:border-emerald-900/35 shadow-sm">
            <svg class="w-6 h-6 text-emerald-505" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-base font-bold text-slate-950 dark:text-white tracking-tight">Keine offenen Fehlstunden</h3>
          <p class="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs leading-relaxed">
            Es wurden keine Fehlstunden gefunden, die auf deine Eingabe passen.
          </p>
        </div>

        <!-- Absences List -->
        <div v-else class="space-y-3">
          <div
            v-for="(absence) in filteredAbsences"
            :key="absence.id"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-800 transition duration-150"
          >
            <!-- Date & Time Row -->
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-slate-100 dark:bg-slate-850 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-550 dark:text-slate-400">
                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-900 dark:text-white">{{ formatDate(absence.date) }}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }} Uhr</span>
              </div>
            </div>

            <!-- Status & Button -->
            <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-slate-100 dark:border-slate-800/80 pt-2.5 sm:pt-0">
              <span
                v-if="absence.isExcusedUntis"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
              >
                Entschuldigt
              </span>
              <span
                v-else
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-650 border border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40"
              >
                Unentschuldigt
              </span>
              <button
                v-if="!absence.isExcusedUntis"
                @click="openModal(absence)"
                class="bg-slate-950 hover:bg-slate-850 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Entschuldigen
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </main>

    <!-- Slide-over Drawer Backdrop overlay -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-40 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
      @click="closeModal"
    ></div>

    <!-- Right Slide-over Drawer Panel -->
    <div
      :class="[
        'fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col',
        showModal ? 'translate-x-0' : 'translate-x-full'
      ]"
    >
      <!-- Success View inside Drawer -->
      <div v-if="submitSuccess" class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900">
        <div class="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/35 mb-4">
          <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-slate-950 dark:text-white">Einreichung erfolgreich!</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
          Dein Entschuldigungsantrag wurde gespeichert und deinem Elternteil zur Freigabe übermittelt.
        </p>
        <button @click="closeModal" class="mt-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-6 py-2.5 rounded-xl text-sm font-bold transition">
          Schließen
        </button>
      </div>

      <!-- Submission Form Drawer View -->
      <div v-else class="flex-1 flex flex-col h-full bg-white dark:bg-slate-900">
        
        <!-- Drawer Header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 transition-colors">
          <div>
            <h3 class="font-black text-lg text-slate-950 dark:text-white tracking-tight">Absenz entschuldigen</h3>
            <span v-if="activeAbsence" class="block text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
              Am {{ formatDate(activeAbsence.date) }} · {{ formatTime(activeAbsence.startTime) }} – {{ formatTime(activeAbsence.endTime) }} Uhr
            </span>
          </div>
          <button @click="closeModal" class="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Drawer Content -->
        <div class="flex-1 p-6 overflow-y-auto space-y-6">
          
          <!-- Reason Text Field -->
          <div>
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Begründung <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="excuseMessage"
              rows="4"
              placeholder="Bitte beschreibe hier den Grund deiner Abwesenheit (z.B. Arztbesuch, Krankheit)..."
              :class="[
                'w-full text-sm border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 text-slate-800 dark:text-white placeholder-slate-400 bg-slate-50 dark:bg-slate-950 transition',
                excuseMessageError
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-slate-200 dark:border-slate-800 focus:ring-primary focus:border-primary',
              ]"
              @input="excuseMessageError = false"
            />
          </div>

          <!-- Attachments Field -->
          <div>
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Anhänge <span class="text-slate-400 dark:text-slate-500 font-normal">(optional, z.B. Arztzeugnis)</span>
            </label>
            
            <div
              class="border border-dashed border-slate-350 dark:border-slate-800 rounded-xl px-6 py-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition bg-slate-50/50 dark:bg-slate-950/20"
              @click="fileInputRef?.click()"
              @dragover.prevent
              @drop="onDrop"
            >
              <svg class="w-6 h-6 mx-auto text-slate-450 dark:text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p class="text-sm text-slate-600 dark:text-slate-400">Datei hierher ziehen oder <span class="text-primary font-bold">durchsuchen</span></p>
              <span class="text-[10px] text-slate-400 block mt-1">Unterstützt PDF, JPG, PNG (max. 10MB)</span>
            </div>
            <input ref="fileInputRef" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple class="hidden" @change="onFileChange" />

            <!-- Selected Files List -->
            <div v-if="excuseFiles.length > 0" class="mt-4 space-y-2 max-h-48 overflow-y-auto">
              <div
                v-for="(file, i) in excuseFiles"
                :key="i"
                class="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-inner transition"
              >
                <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                <span class="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate font-semibold">{{ file.name }}</span>
                <button @click="removeFile(i)" class="text-slate-400 hover:text-red-500 transition px-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- Drawer Footer Actions -->
        <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 transition-colors">
          <button @click="closeModal" class="px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition">
            Abbrechen
          </button>
          <button
            @click="submitExcuse"
            :disabled="submitting"
            class="px-5 py-2.5 bg-primary hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            <svg v-if="submitting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            {{ submitting ? 'Einreichen...' : 'Einreichen' }}
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<style>
</style>
