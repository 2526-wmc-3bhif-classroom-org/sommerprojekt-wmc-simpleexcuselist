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
  { id: 2, name: 'Max Mustermann', date: '23.03.2026', reason: 'Verspätung', status: 'pending', class: '3BHIF' },
  { id: 5, name: 'Max Mustermann', date: '12.03.2026', reason: 'Arzttermin', status: 'confirmed', class: '3BHIF' },
  { id: 3, name: 'Lisa Schmidt', date: '22.03.2026', reason: 'Privat', status: 'confirmed', class: '3BHIF' },
  { id: 4, name: 'Felix Weber', date: '21.03.2026', reason: 'Kein Grund', status: 'pending', class: '3BHIF' },
])

// Edit State
const activeEntry = ref<ExcuseEntry | null>(null)
const reasonDraft = ref('')
const customReasonDraft = ref('')
const statusDraft = ref<ExcuseStatus>('pending')

const reasonsConfirmed = ['Arztbesuch', 'Führerscheinprüfung', 'Bewerbungsgespräch', 'Krankheit', 'Familiärer Termin', 'Sonstiges']
const reasonsPending = ['Verspätung', 'Kein Grund', 'Unentschuldigt Ferngeblieben', 'Sonstiges']

// Search Logic
const searchInput = ref('')
const appliedSearch = ref('')
const showSuggestions = ref(false)

const filteredExcuses = computed(() => {
  const query = appliedSearch.value.trim().toLowerCase()
  return query ? excuses.value.filter(item => item.name.toLowerCase().includes(query)) : excuses.value
})

const openEditor = (entry: ExcuseEntry) => {
  activeEntry.value = entry
  statusDraft.value = entry.status
  reasonDraft.value = entry.reason
  // Falls der Grund nicht in den Listen ist, ist es "Sonstiges"
  const allPredefined = [...reasonsConfirmed, ...reasonsPending]
  if (!allPredefined.includes(entry.reason)) {
    reasonDraft.value = 'Sonstiges'
    customReasonDraft.value = entry.reason
  } else {
    customReasonDraft.value = ''
  }
}

const saveChanges = () => {
  if (!activeEntry.value) return
  const entry = excuses.value.find(e => e.id === activeEntry.value?.id)
  if (entry) {
    entry.status = statusDraft.value
    entry.reason = reasonDraft.value === 'Sonstiges' ? customReasonDraft.value : reasonDraft.value
  }
  activeEntry.value = null
}

const hideSuggestions = () => setTimeout(() => showSuggestions.value = false, 120)
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-start">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">
            Lehrer-Dashboard
          </h1>
          <p class="text-gray-500 text-sm mt-2">Verwaltung von Entschuldigungen</p>
        </div>
        <div class="text-right bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-200">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Offen</div>
          <div class="text-3xl font-black text-blue-600">{{ excuses.filter(e => e.status === 'pending').length }}</div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="mb-8">
        <div class="flex gap-2 max-w-md">
          <input
            v-model="searchInput"
            type="text"
            class="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Schüler suchen..."
            @focus="showSuggestions = true"
            @blur="hideSuggestions"
            @keyup.enter="appliedSearch = searchInput"
          />
          <button @click="appliedSearch = searchInput" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition">
            Suchen
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="space-y-6">
        <!-- Empty State -->
        <div v-if="filteredExcuses.length === 0" class="bg-white rounded-xl px-8 py-12 text-center shadow-sm border border-gray-200">
          <div class="text-4xl mb-4">📋</div>
          <h2 class="text-2xl font-bold text-gray-900">Keine Einträge</h2>
          <p class="text-gray-500 mt-2">Es wurden keine Entschuldigungen gefunden.</p>
        </div>

        <!-- Table -->
        <div v-else class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Schüler</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Klasse</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Datum</th>
                <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Grund</th>
                <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="item in filteredExcuses"
                :key="item.id"
                @click="openEditor(item)"
                class="hover:bg-blue-50/50 transition cursor-pointer"
              >
                <td class="px-6 py-4 font-bold text-gray-900">{{ item.name }}</td>
                <td class="px-6 py-4">
                  <span class="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">{{ item.class }}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ item.date }}</td>
                <td class="px-6 py-4">
                  <span class="text-xs text-gray-600 bg-gray-50 px-3 py-1 rounded border border-gray-200">
                    {{ item.reason }}
                  </span>
                </td>
                <td class="px-6 py-4 text-center">
                  <div v-if="item.status === 'confirmed'" class="text-green-600 text-xs font-bold flex items-center justify-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-green-600"></div>
                    Bestätigt
                  </div>
                  <div v-else class="text-orange-600 text-xs font-bold flex items-center justify-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
                    Ausstehend
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Buttons -->
        <div class="flex justify-between gap-4 pt-4">
          <button
            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-bold uppercase text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="activeEntry" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <!-- Modal Header -->
        <div class="bg-gray-900 text-white p-6">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-xl font-bold uppercase tracking-tight">Status bearbeiten</h3>
              <p class="text-blue-400 font-semibold mt-2">{{ activeEntry.name }}</p>
            </div>
            <span class="text-xs px-3 py-1 bg-white/20 rounded-full font-bold uppercase tracking-widest">{{ activeEntry.class }}</span>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="p-6 space-y-6">
          <!-- Status Selection -->
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Neuer Status</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                @click="statusDraft = 'confirmed'; reasonDraft = reasonsConfirmed[0] ?? 'Sonstiges'"
                :class="[
                  'py-3 px-4 rounded-lg font-bold uppercase text-xs transition',
                  statusDraft === 'confirmed'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                ]"
              >
                Entschuldigt
              </button>
              <button
                @click="statusDraft = 'pending'; reasonDraft = reasonsPending[0] ?? 'Sonstiges'"
                :class="[
                  'py-3 px-4 rounded-lg font-bold uppercase text-xs transition',
                  statusDraft === 'pending'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                ]"
              >
                Nicht Entschuldigt
              </button>
            </div>
          </div>

          <!-- Reason Selection -->
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Grund</label>
            <select
              v-model="reasonDraft"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <template v-if="statusDraft === 'confirmed'">
                <option v-for="r in reasonsConfirmed" :key="r" :value="r">{{ r }}</option>
              </template>
              <template v-else>
                <option v-for="r in reasonsPending" :key="r" :value="r">{{ r }}</option>
              </template>
            </select>
          </div>

          <!-- Custom Reason -->
          <div v-if="reasonDraft === 'Sonstiges' || statusDraft === 'pending'">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Begründung</label>
            <textarea
              v-model="customReasonDraft"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24"
              placeholder="z.B. 15 Minuten zu spät gekommen..."
            ></textarea>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button @click="activeEntry = null" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-3 rounded-lg font-bold uppercase text-xs transition">
            Abbrechen
          </button>
          <button @click="saveChanges" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold uppercase text-xs transition">
            Speichern
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

