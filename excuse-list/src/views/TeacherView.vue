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
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
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


const showArchive = ref(false)

const excuseAbsence = async (id: string) => {
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(`/api/teacher/absences/${id}/excuse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to excuse')
    
    // update locally
    const absence = absences.value.find(a => a.id === id)
    if (absence) absence.status = 'excused'
  } catch (err: any) {
    error.value = err.message
  }
}

const activeAbsences = computed(() => absences.value.filter(a => a.status === 'signed'))
const archivedAbsences = computed(() => absences.value.filter(a => a.status === 'excused'))

const formatDate =  (dateNum: number) => {
  const s = dateNum.toString()
  return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`
}

const formatTime = (timeNum: number) => {
  const s = timeNum.toString().padStart(4, '0')
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`
}

const logout = () => {
  localStorage.removeItem('untis_jwt')
  router.push('/')
}

onMounted(fetchStudents)
</script>

<template>
  <div class="min-h-screen px-6 py-8">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">

      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tight">Lehrer-Dashboard</h1>
          <p class="text-gray-500 text-sm mt-1">
            Klasse <span class="font-bold text-blue-600">{{ teacherClass }}</span>
          </p>
        </div>
        <div class="flex items-center gap-4">
          <div class="bg-white rounded-xl px-6 py-3 shadow-sm border border-gray-200 text-right">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Schüler</div>
            <div class="text-2xl font-black text-blue-600">{{ students.length }}</div>
          </div>
          
          <button
            @click="showArchive = !showArchive"
            :class="[
              'px-5 py-3 rounded-xl font-bold uppercase text-sm transition',
              showArchive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            ]"
          >
            {{ showArchive ? 'Offene Entschuldigungen' : 'Archiv (' + archivedAbsences.length + ')' }}
          </button>
          <button
            @click="logout"

            class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-5 py-3 rounded-xl font-bold uppercase text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Error Banner -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
        <p class="text-sm font-bold text-red-700">{{ error }}</p>
      </div>

      <!-- Split Layout -->
      <div class="flex gap-6 min-h-[70vh]">

        <!-- Left: Student List -->
        <div class="w-72 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Schüler — {{ teacherClass }}
            </h2>
          </div>

          <!-- Loading -->
          <div v-if="loadingStudents" class="flex-1 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>

          <!-- Empty -->
          <div v-else-if="students.length === 0" class="flex-1 flex items-center justify-center px-4 text-center">
            <p class="text-sm text-gray-400">Keine Schüler gefunden.</p>
          </div>

          <!-- List -->
          <div v-else class="flex-1 overflow-y-auto divide-y divide-gray-50">
            <button
              v-for="student in students"
              :key="student.untisId"
              @click="selectStudent(student)"
              :class="[
                'w-full text-left px-5 py-4 transition flex items-center gap-3',
                selectedStudent?.untisId === student.untisId
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-50 text-gray-900'
              ]"
            >
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                  selectedStudent?.untisId === student.untisId ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
                ]"
              >
                {{ student.firstName[0] }}{{ student.lastName[0] }}
              </div>
              <div class="min-w-0">
                <div class="font-bold text-sm truncate">{{ student.lastName }}</div>
                <div :class="['text-xs truncate', selectedStudent?.untisId === student.untisId ? 'text-blue-200' : 'text-gray-400']">
                  {{ student.firstName }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Right: Absences Panel -->
        <div class="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">

          <!-- No student selected -->
          <div v-if="!selectedStudent" class="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900">Schüler auswählen</h3>
            <p class="text-gray-400 text-sm mt-2">Klicken Sie links auf einen Schüler, um seine unterschriebenen Absenzen zu sehen.</p>
          </div>

          <!-- Student selected -->
          <template v-else>
            <!-- Panel Header -->
            <div class="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 class="text-xl font-black text-gray-900">
                  {{ selectedStudent.firstName }} {{ selectedStudent.lastName }}
                </h2>
                <p class="text-xs text-gray-400 mt-0.5 uppercase tracking-wide font-bold">
                  {{ showArchive ? 'Archivierte (entschuldigte) Absenzen' : 'Offene Entschuldigungen' }}
                </p>
              </div>
              <span class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {{ showArchive ? archivedAbsences.length : activeAbsences.length }} Eintrag{{ (showArchive ? archivedAbsences : activeAbsences).length !== 1 ? 'e' : '' }}
              </span>
            </div>

            <!-- Loading -->
            <div v-if="loadingAbsences" class="flex-1 flex items-center justify-center">
              <div class="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>

            <!-- Empty -->
            <div v-else-if="(showArchive ? archivedAbsences : activeAbsences).length === 0" class="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div class="text-4xl mb-4">✓</div>
              <h3 class="text-lg font-bold text-gray-900">Keine Einträge</h3>
              <p class="text-sm text-gray-400 mt-1">Es wurden keine entsprechenden Absenzen gefunden.</p>
            </div>

            <!-- Absences Table -->
            <div v-else class="flex-1 overflow-auto">
              <table class="w-full">
                <thead class="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Datum</th>
                    <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Von</th>
                    <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Bis</th>
                    <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Aktion</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr v-for="absence in (showArchive ? archivedAbsences : activeAbsences)" :key="absence.id" class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm font-semibold text-gray-900">{{ formatDate(absence.date) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.startTime) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatTime(absence.endTime) }}</td>
                    <td class="px-6 py-4 text-center">
                      <button v-if="!showArchive" @click="excuseAbsence(absence.id)" class="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wide transition">
                        Entschuldigen
                      </button>
                      <span v-else class="text-xs font-bold text-gray-400 uppercase">Erledigt</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

        </div>
      </div>
    </div>
  </div>
</template>
