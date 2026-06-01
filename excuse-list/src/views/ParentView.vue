<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

interface Absence {
  id: string
  untisId: number
  date: number
  startTime: number
  endTime: number
  isExcusedUntis: number
  status: string
}

const absences = ref<Absence[]>([])
const loading = ref(true)
const error = ref('')
const router = useRouter()

// --- Modal State ---
const showModal = ref(false)
const activeAbsence = ref<Absence | null>(null)
const excuseMessage = ref('')
const excuseMessageError = ref(false)
const excuseFiles = ref<File[]>([])
const submitting = ref(false)
const submitSuccess = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const formatDate = (dateNum: number) => {
  if (!dateNum) return 'N/A'
  const s = dateNum.toString()
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`
}

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0')
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`
}

const fetchAbsences = async () => {
  const token = localStorage.getItem('untis_jwt')
  if (!token) {
    router.push('/')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/absences', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('untis_jwt')
        router.push('/')
        return
      }
      const errData = await response.json()
      throw new Error(errData.details || 'Failed to fetch absences')
    }
    absences.value = await response.json()
  } catch (err: any) {
    error.value = err.message || 'An error occurred'
  } finally {
    loading.value = false
  }
}

onMounted(fetchAbsences)

const logout = () => {
  localStorage.removeItem('untis_jwt')
  router.push('/')
}

// --- Modal Logic ---
const openModal = (absence: Absence) => {
  activeAbsence.value = absence
  excuseMessage.value = ''
  excuseMessageError.value = false
  excuseFiles.value = []
  submitSuccess.value = false
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  activeAbsence.value = null
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) excuseFiles.value.push(...Array.from(input.files))
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer?.files) excuseFiles.value.push(...Array.from(e.dataTransfer.files))
}

const removeFile = (index: number) => {
  excuseFiles.value.splice(index, 1)
}

const convertFileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })

const submitExcuse = async () => {
  if (!activeAbsence.value) return
  excuseMessageError.value = false

  if (!excuseMessage.value.trim()) {
    excuseMessageError.value = true
    return
  }

  const token = localStorage.getItem('untis_jwt')
  if (!token) {
    router.push('/')
    return
  }

  submitting.value = true
  try {
    const attachments = await Promise.all(
      excuseFiles.value.map(async (f) => ({
        fileName: f.name,
        fileData: await convertFileToBase64(f),
      })),
    )

    const res = await fetch('/api/excuses/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        absenceId: activeAbsence.value.id,
        message: excuseMessage.value,
        attachments,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Unbekannter Fehler')
    }

    submitSuccess.value = true
    await fetchAbsences()
  } catch (err: any) {
    alert('Fehler beim Einreichen: ' + err.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full bg-[#f4f5f7] flex flex-col font-sans">
    <header class="bg-primary/95 text-white shadow-sm flex items-center justify-between px-6 py-3">
      <div class="flex items-center gap-4">
        <div class="bg-white/20 p-2 rounded text-white font-bold tracking-widest text-xs uppercase">
          Excuses
        </div>
        <h1 class="text-xl font-semibold tracking-tight">Schüler-Dashboard</h1>
      </div>
      <div>
        <button
          @click="logout"
          class="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded transition text-sm font-semibold"
        >
          Abmelden
        </button>
      </div>
    </header>

    <main class="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10">
      <div class="flex justify-between items-end mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight">Meine Fehlstunden</h2>
          <p class="text-gray-500 text-sm mt-1">
            Ganz einfach unentschuldigte Absenzen nachreichen.
          </p>
        </div>
        <div class="flex gap-2">
          <button
            @click="fetchAbsences"
            class="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-2 text-sm rounded shadow-sm hover:bg-gray-50 transition"
          >
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Aktualisieren
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div v-if="loading" class="flex justify-center p-12">
          <div
            class="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin"
          ></div>
        </div>

        <div v-else-if="error" class="p-8 bg-red-50 border-l-4 border-red-500 text-red-900">
          <h3 class="font-bold">Fehler beim Laden</h3>
          <p class="text-sm mt-1">{{ error }}</p>
        </div>

        <div v-else-if="absences.length === 0" class="p-16 flex flex-col items-center text-center">
          <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <svg
              class="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900">Alles erledigt!</h3>
          <p class="text-gray-500 text-sm mt-1">
            Du hast keine unentschuldigten Fehlstunden. Super!
          </p>
        </div>

        <table v-else class="w-full text-left text-sm whitespace-nowrap">
          <thead
            class="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase tracking-wider text-xs"
          >
            <tr>
              <th class="px-6 py-4 font-semibold w-12 text-center">#</th>
              <th class="px-6 py-4 font-semibold">Datum</th>
              <th class="px-6 py-4 font-semibold">Zeitraum</th>
              <th class="px-6 py-4 font-semibold text-right">Aktion</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(absence, index) in absences" :key="absence.id" class="hover:bg-gray-50/50">
              <td class="px-6 py-4 text-center font-medium text-gray-500">{{ index + 1 }}</td>
              <td class="px-6 py-4 font-semibold text-gray-900">{{ formatDate(absence.date) }}</td>
              <td class="px-6 py-4 text-gray-600">
                {{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }} Uhr
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  @click="openModal(absence)"
                  class="bg-white border border-gray-300 text-gray-800 hover:border-primary hover:text-primary px-4 py-1.5 rounded font-semibold transition"
                >
                  Entschuldigen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
      @click.self="closeModal"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-gray-200"
      >
        <div v-if="submitSuccess" class="flex flex-col items-center gap-4 px-8 py-10 text-center">
          <div class="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg
              class="w-7 h-7 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <p class="text-lg font-bold text-gray-900">Eingereicht!</p>
            <p class="text-sm text-gray-500 mt-1 pb-4 border-b border-gray-100">
              Dein Formular wurde deinem Elternteil/Aufseher zur Unterschrift weitergeleitet.
            </p>
          </div>
          <button
            @click="closeModal"
            class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-2 rounded text-sm font-semibold transition"
          >
            Schließen
          </button>
        </div>

        <div v-else>
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50"
          >
            <h3 class="font-bold text-gray-900">
              Absenz entschuldigen
              <span class="block text-xs font-normal text-gray-500 mt-0.5">
                {{
                  activeAbsence
                    ? `${formatDate(activeAbsence.date)} · ${formatTime(activeAbsence.startTime)} – ${formatTime(activeAbsence.endTime)}`
                    : ''
                }}
              </span>
            </h3>
            <button
              @click="closeModal"
              class="text-gray-400 hover:text-gray-600 transition p-1 rounded hover:bg-gray-200"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="p-6">
            <div class="mb-5">
              <label class="block text-xs font-semibold text-gray-700 mb-1.5"
                >Begründung <span class="text-red-500">*</span></label
              >
              <textarea
                v-model="excuseMessage"
                rows="3"
                placeholder="Bitte hier die Begründung für die Abwesenheit eintragen..."
                :class="[
                  'w-full text-sm border rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 text-gray-800 placeholder-gray-400 shadow-sm',
                  excuseMessageError
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-primary focus:border-primary',
                ]"
                @input="excuseMessageError = false"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                Anhänge <span class="text-gray-400 font-normal">(optional, z.B. Arztzeugnis)</span>
              </label>
              <div
                class="border border-dashed border-gray-300 rounded px-4 py-4 text-center cursor-pointer hover:border-primary hover:bg-blue-50/10 transition bg-gray-50/50"
                @click="fileInputRef?.click()"
                @dragover.prevent
                @drop="onDrop"
              >
                <p class="text-sm text-gray-600">
                  Datei hierher ziehen oder
                  <span class="text-primary font-semibold">durchsuchen</span>
                </p>
              </div>
              <input
                ref="fileInputRef"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                class="hidden"
                @change="onFileChange"
              />

              <div v-if="excuseFiles.length > 0" class="mt-3 space-y-2 max-h-32 overflow-y-auto">
                <div
                  v-for="(file, i) in excuseFiles"
                  :key="i"
                  class="flex items-center gap-3 px-3 py-1.5 bg-white rounded border border-gray-200 shadow-sm"
                >
                  <svg
                    class="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <span class="text-sm text-gray-700 flex-1 truncate">{{ file.name }}</span>
                  <button
                    @click="removeFile(i)"
                    class="text-gray-400 hover:text-red-500 transition px-1"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              @click="closeModal"
              class="px-4 py-1.5 bg-white border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Abbrechen
            </button>
            <button
              @click="submitExcuse"
              :disabled="submitting"
              class="px-4 py-1.5 bg-primary text-white rounded text-sm font-semibold hover:bg-primary/90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                v-if="submitting"
                class="w-3.5 h-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {{ submitting ? 'Speichern...' : 'Einreichen' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
