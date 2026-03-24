<script setup lang="ts">
import { ref } from 'vue'

const excuses = ref([
  { id: 1, name: 'Kerimcan Yagci', date: '24.03.2026', reason: 'Arztbesuch', status: 'confirmed', class: '3BHIF' },
  { id: 2, name: 'Max Mustermann', date: '23.03.2026', reason: 'Grippe', status: 'pending', class: '3BHIF' },
  { id: 3, name: 'Lisa Schmidt', date: '22.03.2026', reason: 'Privat', status: 'confirmed', class: '3BHIF' },
])
</script>

<template>
  <div class="p-8 bg-base-100 min-h-screen">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold">Teacher Dashboard</h1>
        <p class="text-gray-400">Übersicht der digitalen Entschuldigungen</p>
      </div>
      <div class="stats border border-base-300 bg-base-100">
        <div class="stat">
          <div class="stat-title">Offene Anfragen</div>
          <div class="stat-value text-primary">1</div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="table w-full border-b border-base-200">
        <thead>
          <tr class="text-lg border-b-2 border-base-300">
            <th class="bg-transparent">Schüler</th>
            <th class="bg-transparent">Klasse</th>
            <th class="bg-transparent">Datum</th>
            <th class="bg-transparent">Grund</th>
            <th class="bg-transparent">Status</th>
            <th class="bg-transparent">Aktion</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in excuses"
            :key="item.id"
            class="transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
          >
            <td class="font-bold">{{ item.name }}</td>
            <td><span class="badge badge-ghost border-none bg-base-200">{{ item.class }}</span></td>
            <td>{{ item.date }}</td>
            <td>{{ item.reason }}</td>
            <td>
              <div v-if="item.status === 'confirmed'" class="badge badge-success gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Bestätigt
              </div>
              <div v-else class="badge badge-warning gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Ausstehend
              </div>
            </td>
            <td>
              <button class="btn btn-primary btn-outline btn-xs">Details</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
