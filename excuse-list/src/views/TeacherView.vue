<script setup lang="ts">
import { ref, computed } from 'vue'

const excuses = ref([
  { id: 1, name: 'Kerimcan Yagci', date: '24.03.2026', reason: 'Arztbesuch', status: 'confirmed', class: '3BHIF' },
  { id: 2, name: 'Max Mustermann', date: '23.03.2026', reason: 'Grippe', status: 'pending', class: '3BHIF' },
  { id: 3, name: 'Lisa Schmidt', date: '22.03.2026', reason: 'Privat', status: 'confirmed', class: '3BHIF' },
  { id: 4, name: 'Felix Weber', date: '21.03.2026', reason: 'Zahnarzt', status: 'pending', class: '3BHIF' },
])
const pendingCount = computed(() => {
  return excuses.value.filter(item => item.status === 'pending').length
})

</script>

<template>
  <div class="p-8 bg-base-100 min-h-screen text-base-content">

    <div class="flex justify-between items-center mb-10">
      <div>
        <h1 class="text-4xl font-extrabold tracking-tight">Teacher Dashboard</h1>
        <p class="text-slate-500 mt-2">Verwaltung der digitalen Entschuldigungen</p>
      </div>

      <div class="stats border border-base-200 shadow-sm bg-white">
        <div class="stat">
          <div class="stat-title text-slate-500">Offene Entschuldigungen</div>
          <div class="stat-value text-blue-600">{{pendingCount}}</div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="table w-full border-separate border-spacing-y-2">
        <thead>
          <tr class="text-slate-600 border-b border-base-300">
            <th class="bg-transparent text-sm uppercase">Schüler</th>
            <th class="bg-transparent text-sm uppercase">Klasse</th>
            <th class="bg-transparent text-sm uppercase">Datum</th>
            <th class="bg-transparent text-sm uppercase">Grund</th>
            <th class="bg-transparent text-sm uppercase text-center">Status (Eltern)</th>
            <th class="bg-transparent text-sm uppercase text-right">Aktion</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="item in excuses"
            :key="item.id"
            class="group transition-all duration-200 hover:bg-blue-50 cursor-pointer shadow-sm"
          >
            <td class="font-bold text-slate-700">{{ item.name }}</td>
            <td>
              <span class="badge badge-ghost font-medium px-4 py-3">{{ item.class }}</span>
            </td>
            <td class="text-slate-500">{{ item.date }}</td>
            <td class="italic text-slate-600">{{ item.reason }}</td>
            <td class="text-center">
              <div v-if="item.status === 'confirmed'" class="badge badge-success badge-outline gap-2 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                Bestätigt
              </div>
              <div v-else class="badge badge-warning badge-outline gap-2 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Unentschuldigt
              </div>
            </td>
            <td class="text-right">
              <button class="btn btn-sm btn-outline btn-primary group-hover:btn-active transition-all">
                Details
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Hier brauchst du kaum CSS, da Tailwind & daisyUI alles erledigen */
.table tr {
  border-radius: 12px;
}
</style>
