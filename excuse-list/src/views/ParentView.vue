<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import LightingMode from '@/components/LightingMode.vue';

interface ParentExcuse {
  absenceId: string;
  excuseStatus: string;
  date: number;
  startTime: number;
  endTime: number;
  excuseMessage: string | null;
  studentFirstName: string;
  studentLastName: string;
}

interface Attachment {
  fileName: string;
  fileData: string;
}

const excuses = ref<ParentExcuse[]>([]);
const loading = ref(true);
const error = ref('');
const router = useRouter();

// --- Filter State ---
const searchFilter = ref('');

// --- Multi-Select State ---
const selectedIds = ref<string[]>([]);

// --- Drawer State ---
const showDrawer = ref(false);
const activeExcuse = ref<ParentExcuse | null>(null);
const attachments = ref<Attachment[]>([]);
const loadingAttachments = ref(false);
const signingSingle = ref(false);
const signingBulk = ref(false);

const formatDate = (dateNum: number) => {
  if (!dateNum) return 'N/A';
  const s = dateNum.toString();
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`;
};

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0');
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`;
};

const fetchParentExcuses = async () => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/parent/excuses', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) { localStorage.removeItem('untis_jwt'); router.push('/'); return; }
      const errData = await response.json();
      throw new Error(errData.details || 'Fehler beim Laden der Entschuldigungen');
    }
    excuses.value = await response.json();
  } catch (err: any) {
    error.value = err.message || 'Ein Fehler ist aufgetreten';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchParentExcuses);

const logout = () => {
  localStorage.removeItem('untis_jwt');
  router.push('/');
};

// --- Filtered Excuses ---
const filteredExcuses = computed(() => {
  if (!searchFilter.value) return excuses.value;
  const term = searchFilter.value.trim().toLowerCase();
  return excuses.value.filter(e => {
    const dateStr = formatDate(e.date);
    const timeStr = `${formatTime(e.startTime)} - ${formatTime(e.endTime)}`;
    const studentName = `${e.studentFirstName} ${e.studentLastName}`.toLowerCase();
    const reason = (e.excuseMessage || '').toLowerCase();
    return dateStr.toLowerCase().includes(term) ||
           timeStr.toLowerCase().includes(term) ||
           studentName.includes(term) ||
           reason.includes(term);
  });
});

// --- Selection Logic ---
const isAllSelected = computed(() => {
  const visible = filteredExcuses.value;
  if (visible.length === 0) return false;
  return visible.every(item => selectedIds.value.includes(item.absenceId));
});

const toggleSelectAll = () => {
  const visibleIds = filteredExcuses.value.map(item => item.absenceId);
  if (isAllSelected.value) {
    // Deselect all visible
    selectedIds.value = selectedIds.value.filter(id => !visibleIds.includes(id));
  } else {
    // Select all visible
    const newSelection = new Set([...selectedIds.value, ...visibleIds]);
    selectedIds.value = Array.from(newSelection);
  }
};

const toggleSelect = (id: string) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

// --- Drawer Logic ---
const drawerMode = ref<'grund' | 'anhang'>('grund');

const openDrawer = async (excuse: ParentExcuse, mode: 'grund' | 'anhang') => {
  drawerMode.value = mode;
  activeExcuse.value = excuse;
  showDrawer.value = true;
  loadingAttachments.value = true;
  attachments.value = [];
  try {
    const token = localStorage.getItem('untis_jwt');
    const res = await fetch(`/api/absences/${excuse.absenceId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      attachments.value = await res.json();
    }
  } catch (err) {
    console.error('Fehler beim Laden der Anhänge:', err);
  } finally {
    loadingAttachments.value = false;
  }
};

const closeDrawer = () => {
  showDrawer.value = false;
  activeExcuse.value = null;
  attachments.value = [];
};

// --- Zoom Modal Logic ---
const activeZoomFile = ref<Attachment | null>(null);
const showZoomModal = ref(false);

const openZoom = (file: Attachment) => {
  activeZoomFile.value = file;
  showZoomModal.value = true;
};

const closeZoom = () => {
  activeZoomFile.value = null;
  showZoomModal.value = false;
};

// --- Signature Actions ---
const signSingle = async (absenceId: string) => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }
  signingSingle.value = true;
  try {
    const res = await fetch(`/api/parent/absences/${absenceId}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Unterschrift fehlgeschlagen');
    }
    // Remove from selection if present
    selectedIds.value = selectedIds.value.filter(id => id !== absenceId);
    closeDrawer();
    await fetchParentExcuses();
  } catch (err: any) {
    alert('Fehler beim Unterschreiben: ' + err.message);
  } finally {
    signingSingle.value = false;
  }
};

const signSelectedExcuses = async () => {
  if (selectedIds.value.length === 0) return;
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }
  signingBulk.value = true;
  try {
    await Promise.all(selectedIds.value.map(async id => {
      const res = await fetch(`/api/parent/absences/${id}/sign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Fehler bei ID ${id}`);
      }
    }));
    selectedIds.value = [];
    await fetchParentExcuses();
  } catch (err: any) {
    alert('Fehler bei der Sammel-Unterschrift: ' + err.message);
  } finally {
    signingBulk.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
    
    <!-- Top Navigation Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between px-6 py-4 transition-colors duration-300">
      <div class="flex items-center gap-3">
        <div class="bg-blue-600/10 text-blue-600 p-2 rounded-xl font-bold tracking-widest text-xs uppercase dark:bg-blue-600/20">
          Eltern
        </div>
        <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Eltern-Dashboard</h1>
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
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Entschuldigungsanträge</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sie haben aktuell <span class="font-bold text-blue-600 dark:text-blue-400">{{ excuses.length }}</span> ausstehende Entschuldigung{{ excuses.length === 1 ? '' : 'en' }} zur Unterschrift.
          </p>
        </div>
        <button @click="fetchParentExcuses" class="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2 text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
          <svg class="w-3.5 h-3.5 text-slate-450" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Aktualisieren
        </button>
      </div>

      <!-- Filter & Bulk-Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 p-4 rounded-2xl shadow-sm transition-colors duration-300">
        <div class="relative w-full max-w-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            v-model="searchFilter"
            type="text"
            placeholder="Nach Schüler oder Datum filtern..."
            class="block w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm transition-all"
          />
        </div>

        <!-- Bulk signature action -->
        <div class="flex items-center gap-3">
          <button
            v-if="selectedIds.length > 0"
            @click="signSelectedExcuses"
            :disabled="signingBulk"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg v-if="signingBulk" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            Sammel-Unterschrift ({{ selectedIds.length }} ausgewählt)
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="space-y-4">
        
        <div v-if="loading" class="flex justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 transition-colors duration-300">
          <div class="w-7 h-7 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>

        <div v-else-if="error" class="p-6 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl">
          <h3 class="font-bold text-sm">Fehler beim Laden</h3>
          <p class="text-xs mt-1">{{ error }}</p>
        </div>

        <!-- Empty State Redesigned -->
        <div v-else-if="filteredExcuses.length === 0" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-900 p-10 flex flex-col items-center text-center transition-colors duration-300">
          <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mb-3 border border-emerald-100 dark:border-emerald-900/35 shadow-sm">
            <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-base font-bold text-slate-950 dark:text-white tracking-tight">Keine ausstehenden Anträge</h3>
          <p class="text-slate-555 dark:text-slate-400 text-xs mt-1.5 max-w-xs leading-relaxed">
            Es wurden keine offenen Entschuldigungsanträge gefunden.
          </p>
        </div>

        <!-- Excuses List -->
        <div v-else class="space-y-3">
          
          <!-- Select All bar -->
          <div class="flex items-center px-5 py-2 text-slate-450 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider gap-3">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
              class="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 cursor-pointer transition-colors"
            />
            <span>Alle sichtbaren auswählen</span>
          </div>

          <!-- Cards list -->
          <div
            v-for="(excuse) in filteredExcuses"
            :key="excuse.absenceId"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-350 dark:hover:border-slate-800 transition duration-150"
          >
            <!-- Checkbox & Student Details -->
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                :checked="selectedIds.includes(excuse.absenceId)"
                @change="toggleSelect(excuse.absenceId)"
                class="rounded border-slate-355 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 cursor-pointer transition-colors flex-shrink-0"
              />
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-slate-100 dark:bg-slate-850 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-550 dark:text-slate-400">
                  <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-black text-slate-900 dark:text-white">{{ excuse.studentFirstName }} {{ excuse.studentLastName }}</span>
                  <span class="text-xs text-slate-550 dark:text-slate-400 mt-0.5">{{ formatDate(excuse.date) }} · {{ formatTime(excuse.startTime) }} - {{ formatTime(excuse.endTime) }} Uhr</span>
                </div>
              </div>
            </div>

            <!-- Reason & Buttons -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-slate-100 dark:border-slate-800/80 pt-2.5 sm:pt-0">
              <div class="text-xs text-slate-500 dark:text-slate-400 italic mr-2 max-w-md break-words">
                <span class="font-semibold text-slate-400 dark:text-slate-500 not-italic">Grund:</span> {{ excuse.excuseMessage || 'Keine Begründung angegeben' }}
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="openDrawer(excuse, 'anhang')"
                  class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Anhang
                </button>
                <button
                  @click="signSingle(excuse.absenceId)"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Unterschreiben
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- Slide-over Drawer Backdrop overlay -->
    <div
      v-if="showDrawer"
      class="fixed inset-0 z-40 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
      @click="closeDrawer"
    ></div>

    <!-- Right Slide-over Drawer Panel -->
    <div
      :class="[
        'fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col',
        showDrawer ? 'translate-x-0' : 'translate-x-full'
      ]"
    >
      <!-- Drawer Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 transition-colors">
        <div>
          <h3 class="font-black text-lg text-slate-950 dark:text-white tracking-tight">Antrag prüfen</h3>
          <span v-if="activeExcuse" class="block text-xs font-semibold text-slate-405 dark:text-slate-500 mt-1">
            Für {{ activeExcuse.studentFirstName }} {{ activeExcuse.studentLastName }}
          </span>
        </div>
        <button @click="closeDrawer" class="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Drawer Content -->
      <div v-if="activeExcuse" class="flex-1 p-6 overflow-y-auto space-y-6">
        
        <!-- Details Metadata block -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 p-4 rounded-xl space-y-3">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-wider">Datum</span>
            <span class="text-slate-800 dark:text-slate-200 font-bold">{{ formatDate(activeExcuse.date) }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-wider">Uhrzeit</span>
            <span class="text-slate-800 dark:text-slate-200 font-bold">{{ formatTime(activeExcuse.startTime) }} - {{ formatTime(activeExcuse.endTime) }} Uhr</span>
          </div>
        </div>

        <!-- Mode Tabs -->
        <div class="flex p-1 bg-slate-100 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl shadow-inner transition-colors duration-300">
          <button
            @click="drawerMode = 'grund'"
            :class="[
              'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
              drawerMode === 'grund'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            ]"
          >
            Grund
          </button>
          <button
            @click="drawerMode = 'anhang'"
            :class="[
              'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
              drawerMode === 'anhang'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            ]"
          >
            Anhang
            <span v-if="attachments.length > 0" class="px-1.5 py-0.5 text-[9px] rounded-full bg-blue-600 text-white font-black leading-none">
              {{ attachments.length }}
            </span>
          </button>
        </div>

        <!-- Excuse Reason -->
        <div v-if="drawerMode === 'grund'">
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Begründung des Schülers
          </label>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 min-h-24 whitespace-pre-wrap leading-relaxed">
            {{ activeExcuse.excuseMessage || 'Keine Begründung angegeben.' }}
          </div>
        </div>

        <!-- Attachments Section -->
        <div v-if="drawerMode === 'anhang'">
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Anhänge
          </label>
          
          <div v-if="loadingAttachments" class="flex justify-center py-6 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <div class="w-6 h-6 border-2 border-slate-205 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          
          <div v-else-if="attachments.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
            Keine Anhänge vorhanden.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="(file, i) in attachments"
              :key="i"
              class="border border-slate-205 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 transition"
            >
              <!-- File Header -->
              <div class="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-205 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-350">
                <div class="flex items-center gap-2 truncate pr-2">
                  <svg class="w-4 h-4 text-slate-450 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  <span class="truncate font-bold">{{ file.fileName }}</span>
                </div>
                <a
                  :href="file.fileData"
                  :download="file.fileName"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition inline-flex items-center cursor-pointer"
                >
                  Herunterladen
                </a>
              </div>
              
              <!-- File Preview (Clickable Preview) -->
              <div 
                @click="openZoom(file)" 
                class="p-2 bg-white dark:bg-slate-900/50 cursor-zoom-in hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group relative"
              >
                <div class="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/5 dark:group-hover:bg-white/5 transition flex items-center justify-center rounded-lg pointer-events-none z-10">
                  <div class="opacity-0 group-hover:opacity-100 transition bg-slate-950/60 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
                    Vergrößern
                  </div>
                </div>

                <img
                  v-if="file.fileData.startsWith('data:image')"
                  :src="file.fileData"
                  class="w-full h-auto mx-auto object-contain max-h-72 rounded-lg"
                  alt="Anhang Vorschau"
                />
                <div v-else-if="file.fileData.startsWith('data:application/pdf')" class="relative">
                  <iframe
                    :src="file.fileData"
                    class="w-full h-80 border-0 rounded-lg pointer-events-none"
                  ></iframe>
                </div>
                <div v-else class="p-4 text-xs text-slate-400 dark:text-slate-500 text-center italic">
                  Format wird nicht unterstützt. Bitte herunterladen.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Drawer Footer Actions -->
      <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 transition-colors">
        <button @click="closeDrawer" class="px-4 py-2.5 bg-white dark:bg-slate-855 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition">
          Abbrechen
        </button>
        <button
          v-if="activeExcuse"
          @click="signSingle(activeExcuse.absenceId)"
          :disabled="signingSingle"
          class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <svg v-if="signingSingle" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Unterschreiben
        </button>
      </div>

    </div>

    <!-- Zoom Modal for Attachments -->
    <div
      v-if="showZoomModal && activeZoomFile"
      class="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300"
      @click="closeZoom"
    >
      <div 
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <div class="flex items-center gap-2 truncate pr-4">
            <svg class="w-5 h-5 text-slate-450 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            <h4 class="font-black text-slate-950 dark:text-white truncate text-sm">{{ activeZoomFile.fileName }}</h4>
          </div>
          <div class="flex items-center gap-3">
            <a
              :href="activeZoomFile.fileData"
              :download="activeZoomFile.fileName"
              class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider transition inline-flex items-center cursor-pointer shadow-sm"
            >
              Herunterladen
            </a>
            <button 
              @click="closeZoom" 
              class="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Modal Content (Zoomed Preview) -->
        <div class="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950/40 flex items-center justify-center min-h-[50vh]">
          <img
            v-if="activeZoomFile.fileData.startsWith('data:image')"
            :src="activeZoomFile.fileData"
            class="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md"
            alt="Anhang vergrößert"
          />
          <iframe
            v-else-if="activeZoomFile.fileData.startsWith('data:application/pdf')"
            :src="activeZoomFile.fileData"
            class="w-full h-[70vh] border-0 rounded-xl shadow-md"
          ></iframe>
          <div v-else class="text-slate-500 text-sm italic">
            Format kann nicht vergrößert dargestellt werden. Bitte herunterladen.
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
</style>
