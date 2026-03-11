<script setup>
import { RouterLink } from "vue-router"
import LightingModeView from "@/components/LightingMode.vue";
</script>

<template>
  <div class="navbar bg-base-100 shadow-md px-6">

    <div class="flex-1 flex items-center gap-2">
      <RouterLink to="/" class="text-xl font-bold">
        Excuse List
      </RouterLink>
    </div>

    <div class="flex-none">
      <ul class="menu menu-horizontal gap-2">
        <li><RouterLink to="/parent">Parent</RouterLink></li>
        <li><RouterLink to="/student">Student</RouterLink></li>
        <li><RouterLink to="/teacher">Teacher</RouterLink></li>
        <li><LightingModeView></LightingModeView></li>
      </ul>
    </div>

  </div>
</template>

<style scoped>
</style>
