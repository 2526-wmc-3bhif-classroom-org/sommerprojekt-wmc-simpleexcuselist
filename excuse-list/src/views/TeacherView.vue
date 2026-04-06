<script setup lang="ts">
import { ref, computed } from 'vue'

type ExcuseStatus = 'confirmed' | 'pending'

interface ExcuseEntry {
  id: number
  name: string
  date: string
  reason: string
  status: ExcuseStatus
  class: string
}

const excuses = ref<ExcuseEntry[]>([
  { id: 1, name: 'Kerimcan Yagci', date: '24.03.2026', reason: 'Arztbesuch', status: 'confirmed', class: '3BHIF' },
  { id: 2, name: 'Max Mustermann', date: '23.03.2026', reason: 'Grippe', status: 'pending', class: '3BHIF' },
  { id: 5, name: 'Max Mustermann', date: '12.03.2026', reason: 'Arzttermin', status: 'confirmed', class: '3BHIF' },
  { id: 3, name: 'Lisa Schmidt', date: '22.03.2026', reason: 'Privat', status: 'confirmed', class: '3BHIF' },
  { id: 4, name: 'Felix Weber', date: '21.03.2026', reason: 'Zahnarzt', status: 'pending', class: '3BHIF' },
])

const searchInput = ref('')
const appliedSearch = ref('')
const showSuggestions = ref(false)
const activeMenuId = ref<number | null>(null)

const pendingCount = computed(() => {
  return excuses.value.filter(item => item.status === 'pending').length
})

const studentNames = computed(() => {
  return [...new Set(excuses.value.map(item => item.name))]
})

const suggestions = computed(() => {
  const query = searchInput.value.trim().toLowerCase()

  if (!query) {
    return studentNames.value
  }

  return studentNames.value.filter(name => name.toLowerCase().includes(query))
})

const filteredExcuses = computed(() => {
  const query = appliedSearch.value.trim().toLowerCase()

  if (!query) {
    return excuses.value
  }

  return excuses.value.filter(item => item.name.toLowerCase().includes(query))
})

const applySearch = () => {
  appliedSearch.value = searchInput.value.trim()
  showSuggestions.value = false
}

const selectSuggestion = (name: string) => {
  searchInput.value = name
  appliedSearch.value = name
  showSuggestions.value = false
}

const clearSearch = () => {
  searchInput.value = ''
  appliedSearch.value = ''
  showSuggestions.value = false
}

const toggleMenu = (entryId: number) => {
  activeMenuId.value = activeMenuId.value === entryId ? null : entryId
}

const setStatus = (entryId: number, status: ExcuseStatus) => {
  const entry = excuses.value.find(item => item.id === entryId)
  if (!entry) {
    return
  }

  entry.status = status
  activeMenuId.value = null
}

const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 120)
}

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

    <div class="mb-6">
      <div class="relative max-w-xl">
        <div class="flex gap-2">
          <input
            v-model="searchInput"
            type="text"
            class="input input-bordered w-full"
            placeholder="Schüler suchen..."
            @focus="showSuggestions = true"
            @blur="hideSuggestions"
            @keyup.enter="applySearch"
          />
          <button class="btn btn-primary" @click="applySearch">Suchen</button>
          <button
            v-if="searchInput || appliedSearch"
            class="btn btn-ghost"
            @click="clearSearch"
          >
            Zurücksetzen
          </button>
        </div>

        <ul
          v-if="showSuggestions && suggestions.length"
          class="absolute z-20 mt-2 w-full rounded-xl border border-base-300 bg-white shadow-lg"
        >
          <li v-for="name in suggestions" :key="name">
            <button
              class="w-full px-4 py-2 text-left hover:bg-blue-50"
              @mousedown.prevent="selectSuggestion(name)"
            >
              {{ name }}
            </button>
          </li>
        </ul>
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
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="item in filteredExcuses"
            :key="item.id"
            class="group transition-all duration-200 hover:bg-blue-50 cursor-pointer shadow-sm"
          >
            <td class="font-bold text-slate-700">
              <div class="relative inline-block">
                <button class="link link-hover font-bold" @click.stop="toggleMenu(item.id)">{{ item.name }}</button>

                <div
                  v-if="activeMenuId === item.id"
                  class="absolute left-0 top-8 z-10 w-52 rounded-xl border border-base-300 bg-white p-2 shadow-xl"
                >
                  <p class="px-2 pb-2 text-xs uppercase tracking-wide text-slate-400">Status setzen</p>
                  <button
                    class="btn btn-sm btn-outline btn-success mb-2 w-full"
                    @click.stop="setStatus(item.id, 'confirmed')"
                  >
                    Entschuldigt
                  </button>
                  <button
                    class="btn btn-sm btn-outline btn-warning w-full"
                    @click.stop="setStatus(item.id, 'pending')"
                  >
                    Nicht entschuldigt
                  </button>
                </div>
              </div>
            </td>
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
          </tr>
          <tr v-if="!filteredExcuses.length">
            <td colspan="5" class="py-10 text-center text-slate-500">Keine Schüler für diese Suche gefunden.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
