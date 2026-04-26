<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

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

    router.push('/student');
  } catch (err: any) {
    error.value = err.message || 'Login failed';
  }
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card bg-base-200 w-full max-w-md shadow-xl p-6">
      <figure class="px-10 pt-10">
        <img src="../../pictures/selist-transparent.png" alt="Logo" class="rounded-xl w-32" />
      </figure>
      <div class="card-body">
        <h2 class="card-title justify-center mb-4">Login to WebUntis</h2>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Username</span>
          </label>
          <input
            v-model="username"
            type="text"
            class="input input-bordered w-full"
            placeholder="Username"
            required
          />
        </div>

        <div class="form-control mt-2">
          <label class="label">
            <span class="label-text">Password</span>
          </label>
          <input
            v-model="password"
            type="password"
            class="input input-bordered w-full"
            placeholder="Password"
            required
            @keyup.enter="login"
          />
        </div>

        <div v-if="error" class="text-error text-sm mt-2 text-center">
          {{ error }}
        </div>

        <div class="form-control mt-6">
          <button class="btn btn-primary" @click="login">Login</button>
        </div>
      </div>
    </div>
  </div>
</template>
