<script setup>
import { RouterLink } from "vue-router"
import LightingModeView from "@/components/LightingMode.vue"
import logo from '@/assets/selist.png';
</script>

<template>
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
      <!-- Logo + Brand -->
      <RouterLink to="/" class="flex items-center gap-3 group">
        <img :src="logo" alt="Excuse List Logo" class="w-10 h-10 object-contain drop-shadow-sm rounded-md" />
        <span class="font-bold text-xl text-gray-900 group-hover:text-blue-600 transition">
          Excuse List
        </span>
      </RouterLink>

      <!-- Theme Toggle -->
      <LightingModeView />
    </div>
  </nav>
</template>

<style scoped>
/* Smooth transitions on navigation */
</style>
