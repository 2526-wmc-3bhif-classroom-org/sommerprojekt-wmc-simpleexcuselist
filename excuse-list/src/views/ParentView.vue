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
       }
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
                    @click="signExcuse(excuse.excuseId)"
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
  </div>
</template>

