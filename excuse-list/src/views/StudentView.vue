<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

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

// --- Modal State ---
const showModal = ref(false);
const activeAbsence = ref<Absence | null>(null);
const excuseMessage = ref('');
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

const logout = () => { localStorage.removeItem('untis_jwt'); router.push('/'); };

// --- Modal Logic ---
const openModal = (absence: Absence) => {
  activeAbsence.value = absence;
  excuseMessage.value = '';
  excuseFiles.value = [];
  submitSuccess.value = false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  activeAbsence.value = null;
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) excuseFiles.value.push(...Array.from(input.files));
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.files) excuseFiles.value.push(...Array.from(e.dataTransfer.files));
};

const removeFile = (index: number) => {
  excuseFiles.value.splice(index, 1);
};

const submitExcuse = async () => {
  if (!activeAbsence.value) return;
  const token = localStorage.getItem('untis_jwt');
  if (!token) { router.push('/'); return; }

  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('absenceId', activeAbsence.value.id);
    formData.append('message', excuseMessage.value);
    excuseFiles.value.forEach(f => formData.append('attachments', f));

    const res = await fetch('/api/excuses/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
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
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-[1600px] mx-auto">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-start">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">Meine Fehlstunden</h1>
          <p class="text-gray-500 text-sm mt-2">Unentschuldigte Absenzen</p>
        </div>
        <div class="text-right bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-200">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Offen</div>
          <div class="text-3xl font-black text-blue-600">{{ absences.length }}</div>
        </div>
      </div>

      <div class="space-y-6">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-500">Wird geladen...</p>
          </div>
        </div>

        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
          <p class="font-bold text-red-900">Fehler beim Laden</p>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
        </div>

        <div v-else-if="absences.length === 0" class="bg-white rounded-xl px-8 py-12 text-center shadow-sm border border-gray-200">
          <div class="text-4xl mb-4">✓</div>
          <h2 class="text-2xl font-bold text-green-600">Keine offenen Fehlstunden</h2>
          <p class="text-gray-500 mt-2">Super! Es liegen aktuell keine unentschuldigten Fehlstunden vor.</p>
        </div>

        <div v-else class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Datum</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Von</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bis</th>
              <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Aktion</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
            <tr v-for="(absence, index) in absences" :key="absence.id" class="hover:bg-blue-50/50 transition">
              <td class="px-6 py-4 font-bold text-gray-900">{{ index + 1 }}</td>
              <td class="px-6 py-4 text-sm text-gray-700">{{ formatDate(absence.date) }}</td>
              <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.startTime) }}</td>
              <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.endTime) }}</td>
              <td class="px-6 py-4 text-center">
                <button
                  @click="openModal(absence)"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition"
                >
                  Einreichen
                </button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-between gap-4 pt-4">
          <button @click="logout" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-bold uppercase text-sm transition">Logout</button>
          <button @click="fetchAbsences" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold uppercase text-sm transition">Aktualisieren</button>
        </div>
      </div>
    </div>

    <!-- ====== EXCUSE MODAL ====== -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        <!-- Success State -->
        <div v-if="submitSuccess" class="flex flex-col items-center gap-4 px-8 py-12 text-center">
          <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg class="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <p class="text-lg font-bold text-gray-900">Entschuldigung eingereicht</p>
            <p class="text-sm text-gray-500 mt-1">Die Lehrkraft wurde benachrichtigt und kann den Anhang herunterladen.</p>
          </div>
          <button @click="closeModal" class="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-2 rounded-lg font-bold text-sm uppercase transition">Schließen</button>
        </div>

        <!-- Form State -->
        <template v-else>
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <p class="font-bold text-gray-900 text-sm">Entschuldigung einreichen</p>
                <p class="text-xs text-gray-400">
                  {{ activeAbsence ? `${formatDate(activeAbsence.date)} · ${formatTime(activeAbsence.startTime)} – ${formatTime(activeAbsence.endTime)}` : '' }}
                </p>
              </div>
            </div>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="px-6 py-5 space-y-5">
            <!-- Message -->
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nachricht / Begründung</label>
              <textarea
                v-model="excuseMessage"
                rows="4"
                placeholder="z. B. Mein Kind war wegen einer Erkältung krank und konnte nicht am Unterricht teilnehmen."
                class="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-300"
              />
            </div>

            <!-- File Upload -->
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Anhang <span class="font-normal text-gray-400 normal-case">(optional)</span>
              </label>
              <div
                class="border-2 border-dashed border-gray-200 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition"
                @click="fileInputRef?.click()"
                @dragover.prevent
                @drop="onDrop"
              >
                <svg class="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                <p class="text-sm text-gray-500">Datei hier ablegen oder <span class="text-blue-600 font-semibold">auswählen</span></p>
                <p class="text-xs text-gray-400 mt-1">PDF, JPG, PNG – max. 10 MB</p>
              </div>
              <input ref="fileInputRef" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple class="hidden" @change="onFileChange" />

              <!-- File List -->
              <div v-if="excuseFiles.length > 0" class="mt-3 space-y-2">
                <div
                  v-for="(file, i) in excuseFiles"
                  :key="i"
                  class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                  <span class="text-sm text-gray-700 flex-1 truncate">{{ file.name }}</span>
                  <span class="text-xs text-gray-400 flex-shrink-0">{{ (file.size / 1024).toFixed(0) }} KB</span>
                  <button @click="removeFile(i)" class="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button @click="closeModal" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm uppercase transition">
              Abbrechen
            </button>
            <button
              @click="submitExcuse"
              :disabled="submitting"
              class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-bold text-sm uppercase transition flex items-center justify-center gap-2"
            >
              <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {{ submitting ? 'Wird gesendet…' : 'Einreichen' }}
            </button>
          </div>
        </template>

      </div>
    </div>
    <!-- ====== END MODAL ====== -->

  </div>
</template>
