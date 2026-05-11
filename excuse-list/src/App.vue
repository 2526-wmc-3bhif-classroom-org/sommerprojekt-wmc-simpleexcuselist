<script setup>
import Navbar from "./components/Navbar.vue"
import { RouterView } from "vue-router"
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
    <Navbar />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
