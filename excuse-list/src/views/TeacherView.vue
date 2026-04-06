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
  <div class="p-6 bg-slate-50 min-h-screen text-slate-800">

    <div class="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
      <div>
        <h1 class="text-3xl font-black text-slate-900 uppercase tracking-tighter">Teacher Dashboard</h1>
        <p class="text-slate-500 text-sm italic">Verwaltungssystem v2.0</p>
      </div>
      <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 text-right">
        <span class="text-slate-400 text-[10px] font-black uppercase block tracking-widest">Offen</span>
        <span class="text-2xl font-black text-blue-600">{{ excuses.filter(e => e.status === 'pending').length }}</span>
      </div>
    </div>

    <div class="max-w-[1600px] mx-auto mb-24">
      <div class="relative max-w-md flex gap-2">
        <input
          v-model="searchInput"
          type="text"
          class="input input-sm input-bordered w-full bg-white rounded-xl shadow-sm"
          placeholder="Schüler suchen..."
          @focus="showSuggestions = true"
          @blur="hideSuggestions"
          @keyup.enter="appliedSearch = searchInput"
        />
        <button class="btn btn-sm btn-primary rounded-xl" @click="appliedSearch = searchInput">Suchen</button>
      </div>
    </div>
      <div class="h-6"></div>

    <div class="w-[100%] mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      <table class="table w-full">
        <thead class="bg-slate-50/50">
          <tr class="text-slate-400 uppercase text-[11px] tracking-widest border-b border-slate-100">
            <th class="py-5 px-10">Schüler</th>
            <th>Klasse</th>
            <th>Datum</th>
            <th>Grund / Bemerkung</th>
            <th class="text-center px-10">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredExcuses"
            :key="item.id"
            class="hover:bg-blue-50/20 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
            @click="openEditor(item)"
          >
            <td class="py-4 px-10">
              <span class="font-bold text-slate-700 text-base">{{ item.name }}</span>
            </td>
            <td><span class="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded">{{ item.class }}</span></td>
            <td class="text-slate-500 text-sm">{{ item.date }}</td>
            <td>
              <span class="text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs italic">
                {{ item.reason }}
              </span>
            </td>
            <td class="text-center px-10">
              <div v-if="item.status === 'confirmed'" class="text-emerald-600 text-xs font-bold flex items-center justify-center gap-1">
                <div class="h-1.5 w-1.5 rounded-full bg-emerald-500"></div> Bestätigt
              </div>
              <div v-else class="text-amber-500 text-xs font-bold flex items-center justify-center gap-1">
                <div class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></div> Nicht Entschuldigt
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="activeEntry" class="modal modal-open">
      <div class="modal-box max-w-lg rounded-[2.5rem] p-0 shadow-2xl bg-white border-none overflow-hidden">

        <div class="bg-slate-900 p-8 text-white">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-black uppercase tracking-tight">Status bearbeiten</h3>
            <span class="text-[10px] px-3 py-1 bg-white/20 rounded-full font-bold uppercase tracking-widest">{{ activeEntry.class }}</span>
          </div>
          <p class="text-blue-400 font-bold mt-1">{{ activeEntry.name }}</p>
        </div>

        <div class="p-8 space-y-6">
          <div class="form-control">
            <label class="label-text font-black text-slate-400 uppercase text-[10px] mb-3">Neuer Status</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                class="btn btn-sm h-12 rounded-xl border-2 transition-all"
                :class="statusDraft === 'confirmed' ? 'btn-success text-white' : 'btn-outline border-slate-100 text-slate-400'"
                @click="statusDraft = 'confirmed'; reasonDraft = reasonsConfirmed[0] ?? 'Sonstiges'"
              >
                Entschuldigt
              </button>
              <button
                class="btn btn-sm h-12 rounded-xl border-2 transition-all"
                :class="statusDraft === 'pending' ? 'btn-warning text-white' : 'btn-outline border-slate-100 text-slate-400'"
                @click="statusDraft = 'pending'; reasonDraft = reasonsPending[0] ?? 'Sonstiges'"
              >
                Nicht Entschuldigt
              </button>
            </div>
          </div>

          <div class="form-control">
            <label class="label-text font-black text-slate-400 uppercase text-[10px] mb-2">Grund / Ursache</label>
            <select v-model="reasonDraft" class="select select-sm select-bordered h-12 w-full rounded-xl bg-slate-50 text-sm">
              <template v-if="statusDraft === 'confirmed'">
                <option v-for="r in reasonsConfirmed" :key="r" :value="r">{{ r }}</option>
              </template>
              <template v-else>
                <option v-for="r in reasonsPending" :key="r" :value="r">{{ r }}</option>
              </template>
            </select>
          </div>

          <div v-if="reasonDraft === 'Sonstiges' || statusDraft === 'pending'" class="form-control animate-in fade-in duration-300">
            <label class="label-text font-black text-slate-400 uppercase text-[10px] mb-2">Detaillierte Begründung</label>
            <textarea
              v-model="customReasonDraft"
              class="textarea textarea-bordered w-full rounded-xl bg-slate-50 text-sm h-24"
              placeholder="z.B. 15 Minuten zu spät gekommen..."
            ></textarea>
          </div>
        </div>

        <div class="p-8 pt-0 flex gap-3">
          <button class="btn btn-ghost flex-1 rounded-xl text-xs uppercase font-bold" @click="activeEntry = null">Abbrechen</button>
          <button class="btn btn-primary flex-[2] rounded-xl text-white font-black text-xs uppercase" @click="saveChanges">
            Speichern
          </button>
        </div>
      </div>
      <div class="modal-backdrop bg-slate-900/60 backdrop-blur-md" @click="activeEntry = null"></div>
    </div>
  </div>
</template>

<style scoped>
.modal-box {
  animation: pop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes pop {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
tr { user-select: none; }
</style>
