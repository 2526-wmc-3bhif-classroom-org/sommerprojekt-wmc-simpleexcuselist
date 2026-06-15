<script setup>
import { RouterView } from "vue-router"
</script>

<template>
  <div class="min-h-screen w-full bg-[#f4f5f7] text-gray-800 font-sans flex flex-col">
    <RouterView />
  </div>
</template>

<style>
/* Global resets */
body {
  margin: 0;
  padding: 0;
}
</style>
