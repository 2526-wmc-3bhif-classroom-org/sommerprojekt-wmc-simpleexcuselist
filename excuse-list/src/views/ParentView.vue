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
</script>

<template>
</template>

