<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface Excuse {
  absenceId: string;
  excuseStatus: string;
  date: number;
  startTime: number;
  endTime: number;
  studentFirstName: string;
  studentLastName: string;
  excuseMessage?: string;
}

interface Attachment {
  fileName: string;
  fileData: string;
}

const excuses = ref<Excuse[]>([]);
const loading = ref(true);
const error = ref('');
const router = useRouter();

// Signature Modal State
const showSignatureModal = ref(false);
const activeExcuseId = ref<string | null>(null);
const signatureCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
let ctx: CanvasRenderingContext2D | null = null;
let lastX = 0;
let lastY = 0;

// --- Attachments Modal State ---
const showAttachmentModal = ref(false);
const loadingAttachments = ref(false);
const activeAttachments = ref<Attachment[]>([]);
const activeExcuseMessage = ref('');

const fetchExcuses = async () => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) {
    router.push('/');
    return;
  }
  loading.value = true;
  error.value = '';

  try {
    const res = await fetch('/api/parent/excuses', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('untis_jwt');
        router.push('/');
        return;
      }
      throw new Error(`Fehler beim Laden (${res.status})`);
    }

    const data = await res.json();
    excuses.value = data;
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Einträge';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchExcuses();
});

const formatDate = (dateNum: number) => {
  if (!dateNum) return 'N/A';
  const dateStr = dateNum.toString();
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}.${month}.${year}`;
};

const formatTime = (timeNum: number) => {
  const timeStr = timeNum.toString().padStart(4, '0');
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);
  return `${hours}:${minutes}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return 'badge badge-warning';
    case 'signed':
      return 'badge badge-success';
    case 'rejected':
      return 'badge badge-error';
    default:
      return 'badge';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Ausstehend';
    case 'signed':
      return 'Unterzeichnet';
    case 'rejected':
      return 'Abgelehnt';
    default:
      return status;
  }
};

const viewAttachments = async (excuse: Excuse) => {
  activeExcuseMessage.value = excuse.excuseMessage || '';
  activeAttachments.value = [];
  showAttachmentModal.value = true;

  const token = localStorage.getItem('untis_jwt');
  if (!token) return;

  loadingAttachments.value = true;
  try {
    const res = await fetch(`/api/absences/${excuse.absenceId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      activeAttachments.value = await res.json();
    }
  } catch (e) {
    console.error(e);
  } finally {
    loadingAttachments.value = false;
  }
};

const closeAttachmentModal = () => {
  showAttachmentModal.value = false;
  activeAttachments.value = [];
  activeExcuseMessage.value = '';
};

// Canvas Drawing Logic
const startDrawing = (e: MouseEvent | TouchEvent) => {
  isDrawing.value = true;
  const canvas = signatureCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();

  if (e instanceof MouseEvent) {
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  } else if (e instanceof TouchEvent) {
    const touch = e.touches[0];
    if (touch) {
      lastX = touch.clientX - rect.left;
      lastY = touch.clientY - rect.top;
    }
  }
};

const draw = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing.value || !ctx) return;
  e.preventDefault();
  const canvas = signatureCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();

  let currentX, currentY;
  if (e instanceof MouseEvent) {
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;
  } else if (e instanceof TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    currentX = touch.clientX - rect.left;
    currentY = touch.clientY - rect.top;
  } else {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(currentX, currentY);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  lastX = currentX;
  lastY = currentY;
};

const stopDrawing = () => {
  isDrawing.value = false;
};

const initCanvas = () => {
  if (signatureCanvas.value) {
    ctx = signatureCanvas.value.getContext('2d');
    // Clear canvas
    if (ctx) {
      ctx.clearRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height);
    }
  }
};

const clearSignature = () => {
  if (ctx && signatureCanvas.value) {
    ctx.clearRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height);
  }
};

const openSignatureModal = (excuseId: string) => {
  activeExcuseId.value = excuseId;
  showSignatureModal.value = true;
  // Initialize canvas after a short delay so DOM can render modal
  setTimeout(() => {
    initCanvas();
  }, 50);
};

const closeSignatureModal = () => {
  showSignatureModal.value = false;
  activeExcuseId.value = null;
};

const confirmSignature = async () => {
  if (!activeExcuseId.value) return;

  // Here we could get the signature image: canvas.toDataURL()
  // But for now, we just proceed to call the signExcuse API
  await signExcuse(activeExcuseId.value);
  closeSignatureModal();
};

const signExcuse = async (excuseId: string) => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) {
    router.push('/');
    return;
  }

  try {
    const res = await fetch(`/api/parent/absences/${excuseId}/sign`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${token}`
       },
       // if we wanted to pass signature: body: JSON.stringify({ signature: signatureCanvas.value?.toDataURL() })
    });

    if(!res.ok) throw new Error('Fehler beim Unterzeichnen');

    // Remove locally
    excuses.value = excuses.value.filter(e => e.absenceId !== excuseId);
  } catch(e) {
     console.error(e);
     alert('Konnte nicht unterzeichnet werden.');
  }
};

const rejectExcuse = async (excuseId: string) => {
  // Temporary just hide it locally
  excuses.value = excuses.value.filter(e => e.absenceId !== excuseId);
};

const logout = () => {
  localStorage.removeItem('untis_jwt');
  router.push('/');
};
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-[1600px] mx-auto">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-start">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">
            Eltern-Dashboard
          </h1>
          <p class="text-gray-500 text-sm mt-2">Entschuldigungen zur Bestätigung</p>
        </div>
        <div class="text-right bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-200">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Ausstehend</div>
          <div class="text-3xl font-black text-orange-600">{{ excuses.length }}</div>
        </div>
      </div>

      <!-- Content -->
      <div class="space-y-6">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-16">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-500">Wird geladen...</p>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
          <p class="font-bold text-red-900">Fehler beim Laden</p>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="excuses.length === 0" class="bg-white rounded-xl px-8 py-12 text-center shadow-sm border border-gray-200">
          <div class="text-4xl mb-4">✓</div>
          <h2 class="text-2xl font-bold text-green-600">Alle Entschuldigungen bearbeitet</h2>
          <p class="text-gray-500 mt-2">Es gibt keine ausstehenden Entschuldigungen zu unterzeichnen.</p>
        </div>

        <!-- Table -->
        <div v-else class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Schüler</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Datum</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Von</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bis</th>
                <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Details</th>
                <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Aktion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="(excuse, index) in excuses" :key="excuse.absenceId" class="hover:bg-blue-50/50 transition">
                <td class="px-6 py-4 font-bold text-gray-900">{{ index + 1 }}</td>
                <td class="px-6 py-4 text-sm text-gray-900 font-semibold">{{ excuse.studentFirstName }} {{ excuse.studentLastName }}</td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ formatDate(excuse.date) }}</td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(excuse.startTime) }}</td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(excuse.endTime) }}</td>
                <td class="px-6 py-4 text-center">
                  <button @click="viewAttachments(excuse)" class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition">
                    Ansehen
                  </button>
                </td>
                <td class="px-6 py-4 text-center">
                  <div class="flex gap-2 justify-center">
                    <button
                      @click="openSignatureModal(excuse.absenceId)"
                      class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase transition"
                    >
                      Unterschreiben
                    </button>
                    <button
                      @click="rejectExcuse(excuse.absenceId)"
                      class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase transition"
                    >
                      Ablehnen
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Buttons -->
        <div class="flex justify-between gap-4 pt-4">
          <button
            @click="logout"
            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-bold uppercase text-sm transition"
          >
            Logout
          </button>
          <button
            @click="fetchExcuses"
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold uppercase text-sm transition"
          >
            Aktualisieren
          </button>
        </div>
      </div>
    </div>

    <!-- Signature Modal -->
    <div v-if="showSignatureModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <h3 class="text-2xl font-bold text-gray-900 uppercase tracking-tight mb-4">
          Bitte unterschreiben
        </h3>
        <p class="text-gray-600 mb-6 text-sm">
          Zeichnen Sie Ihre Unterschrift in das untenstehende Feld, um diese Entschuldigung zu bestätigen.
        </p>

        <div class="border-2 border-gray-300 border-dashed rounded-xl bg-gray-50 mb-6 overflow-hidden">
          <canvas
            ref="signatureCanvas"
            width="450"
            height="200"
            class="w-full h-full cursor-crosshair block"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
          ></canvas>
        </div>

        <div class="flex justify-between gap-3 mb-6">
          <button @click="clearSignature" class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg text-sm font-bold transition">
            Zurücksetzen
          </button>
        </div>

        <div class="flex gap-3">
          <button @click="closeSignatureModal" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-3 rounded-lg font-bold uppercase text-sm transition">
            Abbrechen
          </button>
          <button @click="confirmSignature" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold uppercase text-sm transition">
            Bestätigen
          </button>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div v-if="showAttachmentModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="closeAttachmentModal">
      <div class="bg-white rounded-2xl shadow-2xl p-0 w-full max-w-lg flex flex-col max-h-[90vh]">
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

