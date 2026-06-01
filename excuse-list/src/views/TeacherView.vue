<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

interface Student {
  untisId: number
  firstName: string
  lastName: string
  className: string
}

interface Absence {
  id: string
  date: number
  startTime: number
  endTime: number
  status: string
  excuseMessage?: string
}

interface Attachment {
  fileName: string
  fileData: string
}

interface SubjectStat {
  subjectName: string
  subjectLongName: string
  missedLessons: number
}

const router = useRouter()
const students = ref<Student[]>([])
const selectedStudent = ref<Student | null>(null)
const absences = ref<Absence[]>([])
const loadingStudents = ref(true)
const loadingAbsences = ref(false)
const error = ref('')
const teacherName = ref('')
const teacherClass = ref('')

const showAnalytics = ref(false)
const analytics = ref<SubjectStat[]>([])
const loadingAnalytics = ref(false)

const severityClass = (n: number) => {
  if (n <= 2) return 'bg-green-100 text-green-700'
  if (n <= 5) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

// --- Attachments Modal ---
const showAttachmentModal = ref(false)
const loadingAttachments = ref(false)
const activeAttachments = ref<Attachment[]>([])
const activeExcuseMessage = ref('')

const getToken = () => {
  const token = localStorage.getItem('untis_jwt')
  if (!token) {
    router.push('/')
    return null
  }
  return token
}

const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1]!;
    const padLength = (4 - (base64Url.length % 4)) % 4;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
    const payload = JSON.parse(atob(base64));
    teacherName.value = payload.username || ''
    teacherClass.value = payload.className || ''
  } catch {}
}

const fetchStudents = async () => {
  const token = getToken()
  if (!token) return
  decodeToken(token)
  loadingStudents.value = true
  error.value = ''
  try {
    const res = await fetch('/api/teacher/students', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      if (res.status === 401) { localStorage.removeItem('untis_jwt'); router.push('/'); return }
      throw new Error(`Fehler (${res.status})`)
    }
    students.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Schüler'
  } finally {
    loadingStudents.value = false
  }
}

const selectStudent = async (student: Student) => {
  selectedStudent.value = student
  absences.value = []
  analytics.value = []
  showAnalytics.value = false
  const token = getToken()
  if (!token) return
  loadingAbsences.value = true
  try {
    const res = await fetch(`/api/teacher/students/${student.untisId}/absences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`Fehler (${res.status})`)
    absences.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Absenzen'
  } finally {
    loadingAbsences.value = false
  }
}


const fetchAnalytics = async () => {
  if (!selectedStudent.value) return
  const token = getToken()
  if (!token) return
  loadingAnalytics.value = true
  try {
    const res = await fetch(`/api/teacher/students/${selectedStudent.value.untisId}/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`Fehler (${res.status})`)
    analytics.value = await res.json()
  } catch (err: any) {
    error.value = err.message || 'Fehler beim Laden der Analyse'
  } finally {
    loadingAnalytics.value = false
  }
}

const toggleAnalytics = () => {
  showAnalytics.value = !showAnalytics.value
  if (showAnalytics.value) fetchAnalytics()
}

const activeAbsences = computed(() => absences.value.filter(a => a.status === 'signed'))

const formatDate =  (dateNum: number) => {
  const s = dateNum.toString()
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`
}

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0')
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`
}

const viewAttachments = async (absence: Absence) => {
  activeExcuseMessage.value = absence.excuseMessage || ''
  activeAttachments.value = []
  showAttachmentModal.value = true
  const token = getToken()
  if (!token) return

  loadingAttachments.value = true
  try {
    const res = await fetch(`/api/absences/${absence.id}/attachments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      activeAttachments.value = await res.json()
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingAttachments.value = false
  }
}

const closeAttachmentModal = () => {
  showAttachmentModal.value = false
  activeAttachments.value = []
  activeExcuseMessage.value = ''
}

const logout = () => {
  localStorage.removeItem('untis_jwt')
  router.push('/')
}

onMounted(fetchStudents)
</script>

<template>
  <div class="h-screen w-full flex bg-[#f4f5f7] overflow-hidden font-sans">

    <!-- Left Sidebar: Navigation & Student List -->
    <aside class="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full z-10 shadow-sm relative">
      <!-- Sidebar Header -->
      <div class="h-16 flex items-center px-6 border-b border-gray-200 bg-white">
        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Klasse <span class="text-primary">{{ teacherClass }}</span></h1>
      </div>

      <!-- Student List -->
      <div class="flex-1 overflow-y-auto w-full">
        <!-- Loading -->
        <div v-if="loadingStudents" class="flex p-8 justify-center">
          <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
        </div>
        <!-- Empty -->
        <div v-else-if="students.length === 0" class="p-8 text-center text-sm text-gray-400">
          Keine Schüler
        </div>
        <!-- List -->
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="student in students" :key="student.untisId">
            <button
              @click="selectStudent(student)"
              :class="[
                'w-full flex items-center px-6 py-3 text-left transition-colors outline-none',
                selectedStudent?.untisId === student.untisId
                  ? 'bg-primary/10 border-r-4 border-primary'
                  : 'hover:bg-gray-50 border-r-4 border-transparent'
              ]"
            >
              <div class="flex-1 min-w-0">
                <p :class="['text-sm font-semibold truncate', selectedStudent?.untisId === student.untisId ? 'text-primary' : 'text-gray-900']">
                  {{ student.lastName }}, {{ student.firstName }}
                </p>
              </div>
              <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-if="selectedStudent?.untisId === student.untisId">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      </div>

      <!-- Sidebar Footer (Logout) -->
      <div class="p-4 border-t border-gray-200 bg-white">
        <div class="flex items-center mb-3 px-2">
          <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-3 flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <div class="text-sm font-semibold text-gray-700 truncate">{{ teacherName }}</div>
        </div>
        <button @click="logout" class="w-full flex items-center justify-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded border border-gray-200 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span>Abmelden</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col h-full bg-[#f4f5f7] overflow-hidden">
      <!-- Top navbar -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0 shadow-sm">
        <div class="flex items-center text-sm text-gray-500">
          <span>Lehrer-Dashboard</span>
          <span class="mx-2 text-gray-300">/</span>
          <span v-if="selectedStudent" class="font-semibold text-gray-900">
            {{ selectedStudent.firstName }} {{ selectedStudent.lastName }}
          </span>
          <span v-else-if="showClassAnalytics" class="font-semibold text-gray-900">
            Klassenanalyse
          </span>
          <span v-else>Bitte Schüler auswählen</span>
        </div>
      </header>

      <!-- Scrollable content -->
      <div class="flex-1 p-8 flex flex-col min-h-0 relative">
        <div v-if="!selectedStudent" class="flex-grow flex flex-col items-center justify-center opacity-50">
          <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p class="text-gray-500 text-lg">Wählen Sie einen Schüler links aus</p>
        </div>

        <div v-else class="flex-grow flex flex-col min-h-0 w-full">
          <!-- Main Toolbar for Student -->
          <div class="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 class="text-2xl font-bold text-gray-900">
              Offene Entschuldigungen
            </h2>
            <div class="flex items-center space-x-4">
              <!-- View toggle (Liste/Analyse) -->
              <div class="flex space-x-2 bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                <button
                  @click="showAnalytics = false"
                  :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', !showAnalytics ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']"
                >
                  Liste
                </button>
                <button
                  @click="toggleAnalytics"
                  :class="['px-4 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors', showAnalytics ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']"
                >
                  Analyse
                </button>
              </div>
            </div>
          </div>

          <!-- Content Card -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
            <!-- Student Analytics View -->
            <div v-if="showAnalytics" class="flex-1 flex flex-col min-h-0">
               <div v-if="loadingAnalytics" class="p-12 flex-grow flex items-center justify-center">
                 <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
               </div>
                <div v-else-if="analytics.length === 0" class="p-12 flex-grow flex flex-col items-center justify-center text-center">
                  <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <p class="text-gray-500 text-sm font-medium">Keine Fehlstunden in der Analyse vorhanden.</p>
                </div>
               <div v-else class="flex-grow overflow-y-auto min-h-0">
                 <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 z-10">
                      <tr>
                        <th class="px-6 py-3 font-semibold w-1/4">Fach</th>
                        <th class="px-6 py-3 font-semibold">Bezeichnung</th>
                        <th class="px-6 py-3 font-semibold text-right w-1/4">Versäumt</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                      <tr v-for="stat in analytics" :key="stat.subjectName" class="hover:bg-gray-50/50">
                        <td class="px-6 py-4 font-semibold text-gray-900">{{ stat.subjectName }}</td>
                        <td class="px-6 py-4 text-gray-600">{{ stat.subjectLongName || '—' }}</td>
                        <td class="px-6 py-4 text-right">
                          <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold', severityClass(stat.missedLessons)]">
                            {{ stat.missedLessons }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                 </table>
               </div>
            </div>

            <!-- List View (Student Absences) -->
            <div v-else class="flex-1 flex flex-col min-h-0">
               <div v-if="loadingAbsences" class="p-12 flex-grow flex items-center justify-center">
                 <div class="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
               </div>
               <div v-else-if="activeAbsences.length === 0" class="p-12 flex-grow flex flex-col items-center justify-center">
                  <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <p class="text-gray-500 text-sm font-medium">Alle Absenzen wurden bearbeitet.</p>
               </div>
               <div v-else class="flex-grow overflow-y-auto min-h-0">
                 <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 z-10">
                      <tr>
                        <th class="px-6 py-3 font-semibold">Datum</th>
                        <th class="px-6 py-3 font-semibold">Von</th>
                        <th class="px-6 py-3 font-semibold">Bis</th>
                        <th class="px-6 py-3 font-semibold text-center">Status</th>
                        <th class="px-6 py-3 font-semibold text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                      <tr v-for="absence in activeAbsences" :key="absence.id" class="hover:bg-gray-50/50">
                        <td class="px-6 py-4 font-semibold text-gray-900">{{ formatDate(absence.date) }}</td>
                        <td class="px-6 py-4 text-gray-600">{{ formatTime(absence.startTime) }} Uhr</td>
                        <td class="px-6 py-4 text-gray-600">{{ formatTime(absence.endTime) }} Uhr</td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-semibold border border-green-200">
                            Unterschrieben
                          </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <button @click="viewAttachments(absence)" class="text-primary hover:text-orange-700 font-semibold cursor-pointer underline-offset-2 hover:underline">
                            Ansehen
                          </button>
                        </td>
                      </tr>
                    </tbody>
                 </table>
               </div>
            </div>
          </div>

        </div>
      </div>
    </main>

    <!-- Details Modal -->
    <div v-if="showAttachmentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4" @click.self="closeAttachmentModal">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-xl flex flex-col max-h-[90vh] border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-lg">
          <h3 class="font-bold text-gray-900">Details</h3>
          <button @click="closeAttachmentModal" class="text-gray-400 hover:text-gray-900 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <div class="mb-6">
            <label class="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Begründung</label>
            <div class="bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-800 break-words whitespace-pre-wrap">
              {{ activeExcuseMessage || 'Keine Begründung eingegeben' }}
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Anhänge</label>
            <div v-if="loadingAttachments" class="text-sm text-gray-500">Laden...</div>
            <div v-else-if="activeAttachments.length === 0" class="text-sm text-gray-400 italic">Keine Anhänge</div>
            <div v-else class="space-y-4">
              <div v-for="(file, i) in activeAttachments" :key="i" class="border border-gray-200 rounded overflow-hidden">
                <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-600">{{ file.fileName }}</div>
                <div class="p-2">
                  <img v-if="file.fileData.startsWith('data:image')" :src="file.fileData" class="w-full h-auto mx-auto object-contain max-h-64" alt="Anhang" />
                  <iframe v-else-if="file.fileData.startsWith('data:application/pdf')" :src="file.fileData" class="w-full h-64 border-0"></iframe>
                  <div v-else class="p-4 text-sm text-gray-500 text-center">Format wird nicht unterstützt.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-lg flex justify-end">
          <button @click="closeAttachmentModal" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-semibold transition-colors shadow-sm">
            Schließen
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
