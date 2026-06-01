<script setup>
import { ref, onMounted } from 'vue';

const isLightMode = ref(true);

const toggleTheme = (e) => {
  if (!e.target.checked) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    isLightMode.value = false;
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    isLightMode.value = true;
  }
}

onMounted(() => {
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light');
  isLightMode.value = savedTheme !== 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
});
</script>

<template>
  <label class="swap swap-rotate">
    <input type="checkbox" @change="toggleTheme" :checked="isLightMode" />

    <!-- Sun Icon -->
    <svg
      class="swap-on h-5 w-5 fill-current text-gray-900"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24">
      <path d="M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM11 1H13V4H11V1ZM11 20H13V23H11V20ZM3.51472 4.92893L4.92893 3.51472L7.05025 5.63604L5.63604 7.05025L3.51472 4.92893ZM16.9497 18.364L18.364 16.9497L20.4853 19.0711L19.0711 20.4853L16.9497 18.364ZM19.0711 3.51472L20.4853 4.92893L18.364 7.05025L16.9497 5.63604L19.0711 3.51472ZM5.63604 16.9497L7.05025 18.364L4.92893 20.4853L3.51472 19.0711L5.63604 16.9497ZM23 11V13H20V11H23ZM4 11V13H1V11H4Z" />
    </svg>

    <!-- Moon Icon -->
    <svg
      class="swap-off h-5 w-5 fill-current text-gray-600"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24">
      <path d="M10 7C7.24 7 5 9.24 5 12C5 14.76 7.24 17 10 17C12.76 17 15 14.76 15 12C15 9.24 12.76 7 10 7ZM10 15C8.34 15 7 13.66 7 12C7 10.34 8.34 9 10 9C11.66 9 13 10.34 13 12C13 13.66 11.66 15 10 15ZM19 3H16L3.94 16.06L6 18.12L19 5V3Z" />
    </svg>
  </label>
</template>
