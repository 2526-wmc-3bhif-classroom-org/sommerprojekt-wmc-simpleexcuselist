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
  <div class="min-h-screen w-full flex bg-gray-50">
    
    <!-- Left Side: Hero / Graphic (Hidden on mobile) -->
    <div class="hidden lg:flex lg:w-1/2 bg-blue-600 relative overflow-hidden flex-col justify-between p-12">
      <!-- Decorative background elements -->
      <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div class="absolute top-[20%] right-[-10%] w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute bottom-[-20%] left-[20%] w-80 h-80 bg-blue-700 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      
      <div class="relative z-10">
        <div class="bg-white/10 w-fit p-4 rounded-2xl backdrop-blur-sm border border-white/20 mb-8">
          <img :src="logo" alt="Logo" class="h-16 w-auto object-contain brightness-0 invert" />
        </div>
        <h1 class="text-5xl font-black text-white tracking-tight leading-tight mb-6">
          Willkommen bei <br/>
          <span class="text-blue-200">Excuse List</span>
        </h1>
        <p class="text-blue-100 text-lg max-w-md leading-relaxed">
          Das digitale, papierlose Entschuldigungssystem. Verwalten Sie Fehlstunden einfach, schnell und übersichtlich.
        </p>
      </div>
      
      <div class="relative z-10 flex items-center gap-4 text-blue-200/80 text-sm font-medium">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        Sicher verbunden mit der WebUntis API
      </div>
    </div>

    <!-- Right Side: Login Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
      <!-- Mobile Logo (only shows on small screens) -->
      <div class="lg:hidden absolute top-8 left-8">
        <img :src="logo" alt="Logo" class="h-10 w-auto object-contain" />
      </div>

      <div class="w-full max-w-md">
        <div class="mb-10">
          <h2 class="text-3xl font-black text-gray-900 tracking-tight mb-2">Anmelden</h2>
          <p class="text-gray-500 font-medium">Bitte loggen Sie sich mit Ihrem Account ein.</p>
        </div>

        <div class="space-y-6">
          <!-- Username -->
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Benutzername</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                v-model="username"
                type="text"
                class="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                placeholder="z.B. if230180 oder admin"
                :disabled="loading"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Passwort</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                v-model="password"
                type="password"
                class="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                placeholder="••••••••"
                @keyup.enter="login"
                :disabled="loading"
              />
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="flex items-start gap-3 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl animate-fade-in">
            <svg class="h-5 w-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-sm font-medium text-red-800">{{ error }}</p>
          </div>

          <!-- Submit Button -->
          <button
            @click="login"
            :disabled="loading"
            class="w-full relative flex justify-center items-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed group overflow-hidden"
          >
            <span v-if="!loading" class="flex items-center gap-2">
              Einloggen
              <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
            <span v-else class="flex items-center gap-2">
              <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Bitte warten...
            </span>
          </button>
        </div>

        <div class="mt-10 text-center">
          <p class="text-sm text-gray-500 font-medium">
            Entschuldigungen einfach per WebUntis Account verwalten
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
</style>
