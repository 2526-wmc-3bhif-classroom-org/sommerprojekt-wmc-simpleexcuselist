<script setup>
import { RouterLink } from "vue-router"
import LightingModeView from "@/views/LightingModeView.vue";
</script>

<template>
  <div class="navbar bg-base-100 shadow-md px-6">

    <!-- Logo / Title -->
    <div class="flex-1">
      <RouterLink to="/" class="text-xl font-bold">
        Excuse List
      </RouterLink>
    </div>

    <!-- Navigation -->
    <div class="flex-none">
      <ul class="menu menu-horizontal gap-2">
        <li><RouterLink to="/">Home</RouterLink></li>
        <li><RouterLink to="/parent">Parent</RouterLink></li>
        <li><RouterLink to="/student">Student</RouterLink></li>
        <li><RouterLink to="/teacher">Teacher</RouterLink></li>
        <li><LightingModeView></LightingModeView></li>
      </ul>
    </div>

  </div>
</template>
