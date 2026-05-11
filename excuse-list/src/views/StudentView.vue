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

const submitExcuse = async (id: string) => {
  console.log('Submitting excuse for id:', id);
  const token = localStorage.getItem('untis_jwt');
  if (!token) {
    router.push('/');
  }
  const submit = await fetch(`/api/excuses/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      absenceId: id,
    })
  });

  if(!submit.ok) {
    const err = await submit.json().catch(() => ({}));
    console.error('Failed to submit excuse:', err);
    alert('Fehler beim Einreichen: ' + (err.error || 'Unbekannter Fehler'));
  }
  else {
    await fetchAbsences();
  }
};
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-[1600px] mx-auto">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-start">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">
            Meine Fehlstunden
          </h1>
          <p class="text-gray-500 text-sm mt-2">Unentschuldigte Absenzen</p>
        </div>
        <div class="text-right bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-200">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Offen</div>
          <div class="text-3xl font-black text-blue-600">{{ absences.length }}</div>
        </div>
      </div>

      <!-- Content -->
      <div class="space-y-6">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-16">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-500">Wird geladen...</p>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
          <p class="font-bold text-red-900">Fehler beim Laden</p>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="absences.length === 0" class="bg-white rounded-xl px-8 py-12 text-center shadow-sm border border-gray-200">
          <div class="text-4xl mb-4">✓</div>
          <h2 class="text-2xl font-bold text-green-600">Keine offenen Fehlstunden</h2>
          <p class="text-gray-500 mt-2">Super! Es liegen aktuell keine unentschuldigten Fehlstunden vor.</p>
        </div>

        <!-- Table -->
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
                    @click="submitExcuse(absence.id)"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition"
                  >
                    Einreichen
                  </button>
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
            @click="fetchAbsences"
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold uppercase text-sm transition"
          >
            Aktualisieren
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
