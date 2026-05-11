<script setup>
import { RouterLink } from "vue-router"
import LightingModeView from "@/components/LightingMode.vue"
import logo from '../../pictures/selist-transparent.png';
</script>

<template>
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
      <!-- Logo + Brand -->
      <RouterLink to="/" class="flex items-center gap-4 group">
        <img :src="logo" alt="Excuse List Logo" class="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
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
