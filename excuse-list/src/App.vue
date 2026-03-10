<script setup>
import Navbar from "./components/Navbar.vue"
import { RouterView } from "vue-router"
import LightingMode from "@/components/LightingMode.vue";
</script>

<template>

  <main class="p-8">
    <Navbar />
    <RouterView />
  </main>
</template>
