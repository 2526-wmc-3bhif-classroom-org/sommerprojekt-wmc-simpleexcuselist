<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface Absence {
  id: number;
  startDate: number;
  startTime: number;
  endTime: number;
  text: string;
  isExcused: boolean;
  excuseStatus: string | null;
}

const absences = ref<Absence[]>([]);
const loading = ref(true);
const error = ref('');
const router = useRouter();

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

const fetchAbsences = async () => {
  const token = localStorage.getItem('untis_jwt');
  if (!token) {
    router.push('/');
    return;
  }

  try {
    console.log('Fetching absences...');
    const response = await fetch('/api/absences', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('Response status:', response.status);
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Unauthorized, redirecting to login');
        localStorage.removeItem('untis_jwt');
        router.push('/');
        return;
      }
      const errData = await response.json();
      console.error('Fetch error details:', errData);
      throw new Error(errData.details || 'Failed to fetch absences');
    }

    const data = await response.json();
    console.log('Fetched absences data:', data);
    absences.value = data;
  } catch (err: any) {
    console.error('Catch error:', err);
    error.value = err.message || 'An error occurred while fetching absences';
  } finally {
    loading.value = false;
    console.log('Loading finished, absences count:', absences.value.length);
  }
};

onMounted(fetchAbsences);

const logout = () => {
  localStorage.removeItem('untis_jwt');
  router.push('/');
};

const signExcuse = (id: number) => {
  console.log('Signing excuse for id:', id);
};
</script>

<template>
  <div class="p-6 bg-slate-50 min-h-screen text-slate-800">
    <div class="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
      <div>
        <h1 class="text-3xl font-black text-slate-900 uppercase tracking-tighter">
          Student Dashboard
        </h1>
        <p class="text-slate-500 text-sm italic">Offene Fehlstunden</p>
      </div>
      <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 text-right">
        <span class="text-slate-400 text-[10px] font-black uppercase block tracking-widest"
          >Offen</span
        >
        <span class="text-2xl font-black text-blue-600">{{
          absences.length
        }}</span>
      </div>
    </div>

    <div class="max-w-[1600px] mx-auto space-y-6">
      <div v-if="loading" class="flex justify-center py-16">
        <span class="loading loading-spinner loading-lg text-blue-600"></span>
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
        v-else-if="absences.length === 0"
        class="bg-white border border-emerald-100 rounded-3xl shadow-sm px-8 py-10 text-center"
      >
        <h2 class="text-xl font-black text-emerald-600 mb-2">
          Keine unentschuldigten Fehlstunden
        </h2>
        <p class="text-slate-500">
          Alles in Ordnung – es liegen aktuell keine offenen Fehlstunden vor.
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
              <th>Datum</th>
              <th>Von</th>
              <th>Bis</th>
              <th class="text-center px-10">Aktion</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(absence, index) in absences"
              :key="absence.id"
              class="hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0"
            >
              <td class="py-4 px-10 font-bold text-slate-700">
                {{ index + 1 }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatDate(absence.startDate) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(absence.startTime) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(absence.endTime) }}
              </td>
              <td class="text-center px-10">
                <button
                  class="btn btn-sm rounded-xl btn-primary text-white font-bold uppercase text-[11px] tracking-widest"
                  @click="signExcuse(absence.id)"
                >
                  Sign/Excuse
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading" class="flex justify-between items-center pt-4">
        <button
          class="btn btn-ghost rounded-xl text-xs uppercase font-bold text-slate-500 border border-slate-200 bg-white"
          @click="logout"
        >
          Logout
        </button>
        <button
          class="btn btn-primary rounded-xl text-xs uppercase font-black tracking-widest px-6"
          @click="fetchAbsences"
        >
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>
