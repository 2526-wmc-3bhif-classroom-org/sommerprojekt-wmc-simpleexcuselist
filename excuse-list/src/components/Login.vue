<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import logo from '../../pictures/selist-transparent.png';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();

const login = async () => {
  if (!username.value || !password.value) {
    error.value = 'Bitte füllen Sie alle Felder aus.';
    return;
  }
  
  error.value = '';
  loading.value = true;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    if (!response.ok) {
      throw new Error('Ungültige Anmeldedaten. Bitte überprüfen Sie Benutzernamen und Passwort.');
    }

    const data = await response.json();
    localStorage.setItem('untis_jwt', data.token);

    if (data.role === 'parent') {
      router.push('/parent');
    } else if (data.role === 'teacher') {
      router.push('/teacher');
    } else {
      router.push('/student');
    }
  } catch (err: any) {
    error.value = err.message || 'Ein unerwarteter Fehler ist aufgetreten.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50/50">
    
    <div class="w-full max-w-[420px]">
      <!-- Card -->
      <div class="bg-white py-10 px-8 sm:px-12 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        
        <!-- Header -->
        <div class="flex flex-col items-center mb-10">
          <div class="w-20 h-20 bg-blue-50/50 rounded-2xl flex items-center justify-center mb-6 p-4">
            <img :src="logo" alt="Excuse List" class="w-full h-full object-contain" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight">Willkommen zurück</h2>
          <p class="mt-2 text-sm text-gray-500">Loggen Sie sich in Ihren Account ein</p>
        </div>

        <form class="space-y-6" @submit.prevent="login">
          <!-- Username Input -->
          <div>
            <label for="username" class="block text-sm font-semibold leading-6 text-gray-900">
              Benutzername
            </label>
            <div class="mt-2">
              <input
                id="username"
                v-model="username"
                type="text"
                placeholder="z.B. if230180 oder admin"
                :disabled="loading"
                class="block w-full rounded-xl border-0 py-3.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all bg-gray-50/50 focus:bg-white"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <label for="password" class="block text-sm font-semibold leading-6 text-gray-900">
              Passwort
            </label>
            <div class="mt-2">
              <input
                id="password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                :disabled="loading"
                class="block w-full rounded-xl border-0 py-3.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all bg-gray-50/50 focus:bg-white"
              />
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="rounded-xl bg-red-50 p-4 border border-red-100">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              :disabled="loading"
              class="flex w-full justify-center items-center rounded-xl bg-blue-600 px-3 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ loading ? 'Wird angemeldet...' : 'Anmelden' }}
            </button>
          </div>
        </form>

      </div>
      
      <!-- Footer -->
      <p class="text-center text-sm text-gray-500 mt-8">
        Anmeldung mit Ihren WebUntis-Zugangsdaten.
      </p>
    </div>

  </div>
</template>
