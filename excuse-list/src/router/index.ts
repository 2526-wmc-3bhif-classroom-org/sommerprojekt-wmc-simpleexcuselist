import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ParentView from "@/views/ParentView.vue";
import StudentView from "@/views/Studentview.vue";
import TeacherView from "@/views/Teacherview.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/parent',
      name: 'parent',
      component: ParentView,
    },
    {
      path: '/student',
      name: 'student',
      component: StudentView,
    },
    {
      path: '/teacher',
      name: 'teacher',
      component: TeacherView,
    }
  ],
})

export default router
