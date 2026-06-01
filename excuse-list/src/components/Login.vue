<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import logo from '../../pictures/selist-transparent.png';
import LightingMode from './LightingMode.vue';

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const loading = ref(false);
const router = useRouter();

const togglePassword = () => {
  showPassword.value = !showPassword.value;
};

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
  <!-- Main container: Supports smooth transitions between light and dark settings -->
  <div class="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
    
    <!-- Left side: Branding & School Identity (Hidden on mobile/tablet, shown on lg screens) -->
    <div class="hidden lg:flex w-5/12 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between p-16 select-none transition-colors duration-300">
      
      <!-- Top header with logo -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center p-2 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <img :src="logo" alt="Logo" class="w-full h-full object-contain" />
        </div>
        <span class="text-slate-900 dark:text-white font-extrabold text-sm tracking-widest uppercase transition-colors duration-300">Excuse List</span>
      </div>

      <!-- Center: School name & branding -->
      <div class="my-auto">
        <h1 class="text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-6 transition-colors duration-300">
          HTBLA <br/>
          Leonding
        </h1>
        <div class="w-20 h-1.5 bg-primary rounded-full mb-8"></div>
        <p class="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-md leading-relaxed transition-colors duration-300">
          Das offizielle Portal zur einfachen Verwaltung, Einreichung und Freigabe von Fehlstunden.
        </p>
      </div>

      <!-- Bottom footer -->
      <div class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider transition-colors duration-300">
        © 2026 HTBLA Leonding
      </div>
    </div>

    <!-- Right side: Login Mask (Dynamic background, elements centered) -->
    <div class="w-full lg:w-7/12 flex flex-col justify-center items-center p-6 sm:p-12 bg-slate-50 dark:bg-slate-950 min-h-screen relative transition-colors duration-300">
      
      <!-- Absolute positioning of the Theme Toggle so it stays in the corner and doesn't push the card -->
      <div class="absolute top-6 right-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-sm transition-colors duration-300">
        <LightingMode />
      </div>

      <!-- Centered Login Card with spacious padding and max width -->
      <div class="w-full max-w-[520px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-[32px] shadow-sm p-12 sm:p-16 transition-colors duration-300">
        
        <!-- Brand logo (shown only on mobile/tablet viewports) -->
        <div class="lg:hidden flex flex-col items-center mb-8">
          <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center p-2 mb-3 border border-slate-200/50 dark:border-slate-700 transition-colors duration-300">
            <img :src="logo" alt="Logo" class="w-full h-full object-contain" />
          </div>
          <h2 class="text-2xl font-black text-slate-955 dark:text-white tracking-tight transition-colors duration-300">Excuse List</h2>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors duration-300">HTBLA Leonding Fehlstunden-Portal</p>
        </div>

        <!-- Form Title (Desktop) -->
        <div class="hidden lg:block mb-10">
          <h3 class="text-3xl font-black text-slate-950 dark:text-white tracking-tight transition-colors duration-300">Anmelden</h3>
          <p class="text-sm text-slate-400 dark:text-slate-500 mt-2.5 leading-relaxed transition-colors duration-300">
            Geben Sie Ihre gewohnten WebUntis-Zugangsdaten ein.
          </p>
        </div>

        <!-- Spacious Form Fields (space-y-9 for separation) -->
        <form class="space-y-9" @submit.prevent="login">
          <!-- Username Input -->
          <div>
            <label for="username" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 transition-colors duration-300">
              Benutzername
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-slate-400 dark:text-slate-500 transition-colors duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                id="username"
                v-model="username"
                type="text"
                placeholder="z.B. if230180"
                :disabled="loading"
                class="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 sm:text-sm transition-all duration-150 disabled:opacity-50"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <label for="password" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 transition-colors duration-300">
              Passwort
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-slate-400 dark:text-slate-500 transition-colors duration-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                :disabled="loading"
                class="block w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 sm:text-sm transition-all duration-150 disabled:opacity-50"
              />
              <button
                type="button"
                @click="togglePassword"
                class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors duration-150 cursor-pointer"
              >
                <!-- Eye open -->
                <svg v-if="showPassword" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <!-- Eye closed -->
                <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 01-1.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 transition-all">
            <div class="flex items-start">
              <div class="flex-shrink-0 mt-0.5">
                <svg class="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3 text-xs font-semibold text-red-700 dark:text-red-400">
                {{ error }}
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <button
              type="submit"
              :disabled="loading"
              class="flex w-full justify-center items-center rounded-xl bg-primary hover:bg-orange-600 px-4 py-4 text-sm font-bold text-white shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ loading ? 'Anmelden...' : 'Anmelden' }}</span>
            </button>
          </div>
        </form>

        <!-- Safe info text (spaced-out bottom margin) -->
        <div class="mt-10 text-center border-t border-slate-100 dark:border-slate-800/80 pt-8 transition-colors duration-300">
          <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider transition-colors duration-300">
            🔒 Verbindung verschlüsselt direkt zu WebUntis
          </p>
        </div>

      </div>
      
      <!-- Mobile footer (shown on mobile layout sizes only) -->
      <div class="text-center lg:hidden text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-8 transition-colors duration-300">
        © 2026 HTBLA Leonding
      </div>
    </div>

  </div>
</template>

<style>
</style>

