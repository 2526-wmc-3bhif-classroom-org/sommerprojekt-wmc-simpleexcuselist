<template>
  <div class="home">
  <h1>Who are you</h1>
    <RouterLink to="/parent">Parent</RouterLink>
    <RouterLink to="/student">Student</RouterLink>
    <RouterLink to="/teacher">Teacher</RouterLink>
  </div>
</template>

<script setup lang="ts">
// einfache Home-Komponente
import {RouterLink} from "vue-router";
</script>

<style scoped>
.home {
  padding: 1rem;
}

h1{
  font-size: 55px;

}
</style>
