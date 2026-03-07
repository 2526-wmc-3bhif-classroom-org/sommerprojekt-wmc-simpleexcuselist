<script setup>
import NavbarView from "./views/NavbarView.vue"
import { RouterView } from "vue-router"
import LightingModeView from "@/views/LightingModeView.vue";
</script>

<template>
  <NavbarView />
  <main class="p-8">
    <RouterView />
  </main>
</template>
