<script setup>
import { RouterLink } from "vue-router"
import LightingModeView from "@/components/LightingMode.vue"
</script>

<template>
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
      <!-- Logo + Brand -->
      <RouterLink to="/" class="flex items-center gap-3 group">
        <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-lg">EL</span>
        </div>
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
