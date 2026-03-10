<script setup>
import Navbar from "./components/Navbar.vue"
import Login from "./components/Login.vue"
import { RouterView } from "vue-router"
import LightingMode from "@/components/LightingMode.vue";
</script>

<template>

  <Navbar />
  <main class="p-8">
    <RouterView />
  </main>
</template>

