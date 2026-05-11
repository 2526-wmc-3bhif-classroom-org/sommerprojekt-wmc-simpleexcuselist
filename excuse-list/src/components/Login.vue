<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import logo from '@/assets/selist.png';

const username = ref('');
const password = ref('');
const error = ref('');
const router = useRouter();

const login = async () => {
  error.value = '';
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
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    localStorage.setItem('untis_jwt', data.token);

    if (data.role === 'parent') {
      router.push('/parent');
    } else {
      router.push('/student');
    }
  } catch (err: any) {
    error.value = err.message || 'Login failed';
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center mb-4">
          <img :src="logo" alt="Excuse List Logo" class="h-20 w-auto rounded-xl object-contain drop-shadow-md" />
        </div>
        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">
          Excuse List
        </h1>
        <p class="text-gray-500 text-sm mt-2">Benutzer-Login</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
        <!-- Username Input -->
        <div>
          <label class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
            Benutzername
          </label>
          <input
            v-model="username"
            type="text"
            class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            placeholder="z.B. if230180"
            required
          />
        </div>

        <!-- Password Input -->
        <div>
          <label class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
            Passwort
          </label>
          <input
            v-model="password"
            type="password"
            class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            placeholder="Passwort eingeben"
            required
            @keyup.enter="login"
          />
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {{ error }}
        </div>

        <!-- Login Button -->
        <button
          @click="login"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg uppercase tracking-wide transition"
        >
          Anmelden
        </button>

        <!-- Footer Text -->
        <p class="text-xs text-gray-500 text-center">
          Verwenden Sie Ihre WebUntis-Anmeldedaten
        </p>
      </div>
    </div>
  </div>
</template>
