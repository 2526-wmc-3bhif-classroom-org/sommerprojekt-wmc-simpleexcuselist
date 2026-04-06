<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

interface Excuse {
  id: number;
  studentName: string;
  startDate: number;
  startTime: number;
  endTime: number;
  reason: string;
  status: 'pending' | 'signed' | 'rejected';
  excuseStatus: string | null;
}

const excuses = ref<Excuse[]>([
  {
    id: 1,
    studentName: 'Max Mustermann',
    startDate: 20260403,
    startTime: 800,
    endTime: 1000,
    reason: 'Zahnarzt',
    status: 'pending',
    excuseStatus: null,
  },
  {
    id: 2,
    studentName: 'Max Mustermann',
    startDate: 20260404,
    startTime: 1000,
    endTime: 1200,
    reason: 'Krank',
    status: 'signed',
    excuseStatus: 'accepted',
  },
  {
    id: 3,
    studentName: 'Max Mustermann',
    startDate: 20260405,
    startTime: 1400,
    endTime: 1600,
    reason: 'Schulausflug',
    status: 'pending',
    excuseStatus: null,
  },
]);

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

const signExcuse = (id: number) => {
  const excuse = excuses.value.find(e => e.id === id);
  if (excuse) {
    excuse.status = 'signed';
    console.log('Excuse signed:', id);
  }
};

const rejectExcuse = (id: number) => {
  const excuse = excuses.value.find(e => e.id === id);
  if (excuse) {
    excuse.status = 'rejected';
    console.log('Excuse rejected:', id);
  }
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
          excuses.filter(e => e.status === 'pending').length
        }}</span>
      </div>
    </div>

    <div class="max-w-[1600px] mx-auto space-y-6">
      <div
        v-if="excuses.length === 0"
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
              <th>Grund</th>
              <th class="text-center">Status</th>
              <th class="text-center px-10">Aktion</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(excuse, index) in excuses"
              :key="excuse.id"
              class="hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0"
            >
              <td class="py-4 px-10 font-bold text-slate-700">
                {{ index + 1 }}
              </td>
              <td class="text-slate-700 text-sm font-semibold">
                {{ excuse.studentName }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatDate(excuse.startDate) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(excuse.startTime) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ formatTime(excuse.endTime) }}
              </td>
              <td class="text-slate-500 text-sm">
                {{ excuse.reason }}
              </td>
              <td class="text-center">
                <span :class="getStatusBadge(excuse.status)" class="text-xs font-bold">
                  {{ getStatusText(excuse.status) }}
                </span>
              </td>
              <td class="text-center px-10">
                <div class="flex gap-2 justify-center">
                  <button
                    v-if="excuse.status === 'pending'"
                    class="btn btn-sm rounded-xl btn-success text-white font-bold uppercase text-[11px] tracking-widest"
                    @click="signExcuse(excuse.id)"
                  >
                    Unterschreiben
                  </button>
                  <button
                    v-if="excuse.status === 'pending'"
                    class="btn btn-sm rounded-xl btn-error text-white font-bold uppercase text-[11px] tracking-widest"
                    @click="rejectExcuse(excuse.id)"
                  >
                    Ablehnen
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
</template>

