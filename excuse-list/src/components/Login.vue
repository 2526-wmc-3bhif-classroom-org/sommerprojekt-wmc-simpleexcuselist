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
  <div class="min-h-screen flex flex-col justify-center items-center py-20 px-4 sm:px-6 lg:px-8 animated-bg relative overflow-hidden">
    
    <!-- Decorative Ambient Background Elements -->
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob"></div>
    <div class="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
    <div class="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob animation-delay-4000"></div>

    <div class="w-full max-w-[520px] relative z-10 animate-fade-in-up">
      <!-- Card -->
      <div class="bg-white/80 backdrop-blur-2xl py-16 px-10 sm:px-16 rounded-[3.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50">
        
        <!-- Header -->
        <div class="flex flex-col items-center mb-16">
          <!-- Bigger Logo with gentle hover effect -->
          <div class="w-36 h-36 bg-gradient-to-tr from-white to-blue-50/50 rounded-[2.5rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.02),0_4px_10px_rgba(0,0,0,0.02)] flex items-center justify-center mb-10 p-4 group transition-transform duration-500 hover:scale-105">
            <img :src="logo" alt="Excuse List" class="w-full h-full object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-500" />
          </div>
          <h2 class="text-4xl font-black text-gray-900 tracking-tight text-center">Excuse List</h2>
          <p class="mt-4 text-lg text-gray-500 font-medium">Loggen Sie sich ein, um fortzufahren</p>
        </div>

        <form class="space-y-12" @submit.prevent="login">
          <!-- Username Input -->
          <div>
            <label for="username" class="block text-sm font-bold text-gray-700 uppercase tracking-widest mb-4 ml-2">
              Benutzername
            </label>
            <div>
              <input
                id="username"
                v-model="username"
                type="text"
                placeholder="z.B. if230180 oder admin"
                :disabled="loading"
                class="block w-full rounded-2xl border-0 py-5 px-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200/80 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-lg leading-6 transition-all duration-300 bg-white/50 hover:bg-white focus:bg-white disabled:opacity-50"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <label for="password" class="block text-sm font-bold text-gray-700 uppercase tracking-widest mb-4 ml-2">
              Passwort
            </label>
            <div>
              <input
                id="password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                :disabled="loading"
                class="block w-full rounded-2xl border-0 py-5 px-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200/80 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-lg leading-6 transition-all duration-300 bg-white/50 hover:bg-white focus:bg-white disabled:opacity-50"
              />
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="rounded-2xl bg-red-50 p-5 border border-red-100 animate-shake mt-12">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-4">
                <p class="text-base font-semibold text-red-800">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-6">
            <button
              type="submit"
              :disabled="loading"
              class="flex w-full justify-center items-center rounded-2xl bg-blue-600 px-4 py-5 text-lg font-bold text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:bg-blue-500 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ loading ? 'Wird angemeldet...' : 'Anmelden' }}
            </button>
          </div>
        </form>

      </div>
      
      <!-- Footer -->
      <p class="text-center text-base font-medium text-gray-500/80 mt-16 mb-8">
        Sichere Anmeldung mit Ihren WebUntis-Daten
      </p>
    </div>

  </div>
</template>

<style>
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animated-bg {
  background: linear-gradient(-45deg, #f8fafc, #e0e7ff, #dbeafe, #f3f4f6);
  background-size: 400% 400%;
  animation: gradient 15s ease infinite;
}

@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 10s infinite alternate;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
</style>
