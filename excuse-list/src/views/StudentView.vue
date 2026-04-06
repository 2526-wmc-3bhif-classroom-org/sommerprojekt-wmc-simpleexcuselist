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
    const response = await fetch('http://localhost:3000/api/absences', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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

const signExcuse = (id: number) => {
  console.log('Signing excuse for id:', id);
};
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Open Absences</h1>

    <div v-if="loading" class="flex justify-center p-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <div v-else-if="absences.length === 0" class="card bg-base-200 shadow-xl p-10 text-center">
      <div class="card-body">
        <h2 class="card-title justify-center">No unexcused absences!</h2>
        <p>Everything is fine. You are a good student.</p>
      </div>
    </div>

    <div v-else class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 shadow-lg">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(absence, index) in absences" :key="absence.id">
            <th>{{ index + 1 }}</th>
            <td>{{ formatDate(absence.startDate) }}</td>
            <td>{{ formatTime(absence.startTime) }}</td>
            <td>{{ formatTime(absence.endTime) }}</td>
            <td>
              <button class="btn btn-sm btn-outline btn-accent" @click="signExcuse(absence.id)">
                Sign/Excuse
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading" class="mt-6 flex justify-between">
      <button class="btn" @click="fetchAbsences">Refresh</button>
      <button class="btn btn-ghost" @click="router.push('/')">Logout</button>
    </div>
  </div>
</template>
