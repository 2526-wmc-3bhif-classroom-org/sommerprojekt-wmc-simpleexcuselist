<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface Excuse {
  excuseId: string;
  excuseStatus: string;
  absenceId: string;
  date: number;
  startTime: number;
  endTime: number;
  studentFirstName: string;
  studentLastName: string;
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
    lastX = e.touches[0].clientX - rect.left;
    lastY = e.touches[0].clientY - rect.top;
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
    currentX = e.touches[0].clientX - rect.left;
    currentY = e.touches[0].clientY - rect.top;
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
    const res = await fetch(`/api/parent/excuses/${excuseId}/sign`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${token}`
       },
       // if we wanted to pass signature: body: JSON.stringify({ signature: signatureCanvas.value?.toDataURL() })
    });

    if(!res.ok) throw new Error('Fehler beim Unterzeichnen');

    // Remove locally
    excuses.value = excuses.value.filter(e => e.excuseId !== excuseId);
  } catch(e) {
     console.error(e);
     alert('Konnte nicht unterzeichnet werden.');
  }
};

const rejectExcuse = async (excuseId: string) => {
  // Temporary just hide it locally
  excuses.value = excuses.value.filter(e => e.excuseId !== excuseId);
};

const logout = () => {
  localStorage.removeItem('untis_jwt');
  router.push('/');
};
</script>

<template>
  <div class="p-6 bg-slate-50 min-h-screen text-slate-800">
    <div class="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
      <div>
        <h1 class="text-3xl font-black text-slate-900 uppercase tracking-tighter">
          Eltern Dashboard
        </h1>
        <p class="text-slate-500 text-sm italic">Entschuldigungen zur Bestätigung</p>
      </div>
      <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 text-right">
        <span class="text-slate-400 text-[10px] font-black uppercase block tracking-widest"
          >Ausstehend</span
        >
        <span class="text-2xl font-black text-orange-600">{{
          excuses.length
        }}</span>
      </div>
    </div>

    <div class="max-w-[1600px] mx-auto space-y-6">
      <div v-if="loading" class="flex justify-center py-16">
        <span class="loading loading-spinner loading-lg text-orange-600"></span>
      </div>

      <div
        v-else-if="error"
        class="bg-white border border-red-100 text-red-600 rounded-3xl shadow-sm px-8 py-6 flex items-center gap-3"
      >
        <div class="h-2 w-2 rounded-full bg-red-500"></div>
        <div>
          <p class="font-bold text-sm uppercase tracking-widest">
            Fehler beim Laden
          </p>
          <p class="text-sm">{{ error }}</p>
        </div>
      </div>

      <div
        v-else-if="excuses.length === 0"
        class="bg-white border border-emerald-100 rounded-3xl shadow-sm px-8 py-10 text-center"
      >
        <h2 class="text-xl font-black text-emerald-600 mb-2">
          Keine ausstehenden Entschuldigungen
        </h2>
        <p class="text-slate-500">
          Alle Entschuldigungen wurden überprüft und unterzeichnet.
        </p>
      </div>

      <div
        v-else
        class="w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <table class="table w-full">
          <thead class="bg-slate-50/50">
            <tr class="text-slate-400 uppercase text-[11px] tracking-widest border-b border-slate-100">
              <th class="py-5 px-10">#</th>
              <th>Schüler</th>
              <th>Datum</th>
              <th>Von</th>
              <th>Bis</th>
              <th class="text-center px-10">Aktion</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(excuse, index) in excuses"
              :key="excuse.excuseId"
              class="hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0"
            >
              <td class="py-4 px-10 font-bold text-slate-700">
                {{ index + 1 }}
              </td>
              <td class="text-slate-700 text-sm font-semibold">
                {{ excuse.studentFirstName }} {{ excuse.studentLastName }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatDate(excuse.date) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(excuse.startTime) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(excuse.endTime) }}
              </td>
              <td class="text-center px-10">
                <div class="flex gap-2 justify-center">
                  <button
                    class="btn btn-sm rounded-xl btn-success text-white font-bold uppercase text-[11px] tracking-widest"
                    @click="openSignatureModal(excuse.excuseId)"
                  >
                    Unterschreiben
                  </button>
                  <button
                    class="btn btn-sm rounded-xl btn-error text-white font-bold uppercase text-[11px] tracking-widest"
                    @click="rejectExcuse(excuse.excuseId)"
                  >
                    Ablehnen
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center pt-4">
        <button
          class="btn btn-ghost rounded-xl text-xs uppercase font-bold text-slate-500 border border-slate-200 bg-white"
          @click="logout"
        >
          Logout
        </button>
        <button
          class="btn btn-primary rounded-xl text-xs uppercase font-black tracking-widest px-6"
          @click="fetchExcuses"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Signature Modal -->
    <div v-if="showSignatureModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg">
        <h3 class="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          Bitte Unterschreiben
        </h3>
        <p class="text-slate-500 mb-4 text-sm">
          Zeichnen Sie Ihre Unterschrift in das untenstehende Feld, um diese Entschuldigung zu bestätigen.
        </p>

        <div class="border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 mb-4 overflow-hidden touch-none relative">
          <canvas
            ref="signatureCanvas"
            width="450"
            height="200"
            class="w-full h-full cursor-crosshair"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
          ></canvas>
        </div>

        <div class="flex justify-between items-center gap-3 mt-6">
          <button class="btn btn-ghost text-slate-500 text-xs uppercase font-bold rounded-xl" @click="clearSignature">
            Zurücksetzen
          </button>

          <div class="flex gap-2">
            <button class="btn btn-outline border-slate-200 text-slate-500 rounded-xl uppercase text-xs font-bold" @click="closeSignatureModal">
              Abbrechen
            </button>
            <button class="btn btn-success text-white rounded-xl uppercase text-xs font-bold" @click="confirmSignature">
              Bestätigen
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- End Signature Modal -->
  </div>
</template>

