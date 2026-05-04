import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ParentView from "@/views/ParentView.vue";
import StudentView from "@/views/StudentView.vue";
import TeacherView from "@/views/TeacherView.vue";

function getUserRoleFromToken(token: string): string | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const decoded = JSON.parse(jsonPayload);
    return decoded.role || null;
  } catch (e) {
    return null;
  }
}

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

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('untis_jwt');

  // Not logged in and trying to access protected route
  if (to.path !== '/' && !token) {
    return next('/');
  }

  if (token) {
    const role = getUserRoleFromToken(token);

    if (!role) {
      // Invalid token
      localStorage.removeItem('untis_jwt');
      if (to.path !== '/') return next('/');
      return next();
    }

    // Role-based restrictions
    if (to.path === '/parent' && role !== 'parent') {
      return next(`/${role}`);
    }
    if (to.path === '/student' && role !== 'student') {
      return next(`/${role}`);
    }
    if (to.path === '/teacher' && role !== 'teacher') {
      return next(`/${role}`);
    }

    // If logged in and at root, redirect to role dashboard
    if (to.path === '/') {
      return next(`/${role}`);
    }
  }

  next();
});

export default router
