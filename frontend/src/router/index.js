import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'public-request',
      component: () => import('../views/PublicRequestView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/painel',
      name: 'panel',
      component: () => import('../views/PanelView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/painel/operadores',
      name: 'operators-list',
      component: () => import('../views/OperatorsListView.vue'),
      meta: { requiresAuth: true, requiresAdminMaster: true },
    },
    {
      path: '/painel/operadores/novo',
      name: 'operators-create',
      component: () => import('../views/OperatorCreateView.vue'),
      meta: { requiresAuth: true, requiresAdminMaster: true },
    },
    {
      path: '/painel/logs',
      name: 'logs-list',
      component: () => import('../views/RescueStatusLogsView.vue'),
      meta: { requiresAuth: true, requiresAdminMaster: true },
    },
    {
      // Endereço inexistente: leva ao painel quem tem sessão e à tela pública
      // quem não tem — sem passar pelo login, para não indicar que um endereço
      // dentro de /painel pertence à área do operador.
      path: '/:pathMatch(.*)*',
      redirect: () => (useAuthStore().isAuthenticated ? { name: 'panel' } : { name: 'public-request' }),
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }

  // Operadores não têm acesso à gestão de operadores — apenas o admin master.
  if (to.meta.requiresAdminMaster && authStore.user?.role !== 'admin_master') {
    return { name: 'panel' }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'panel' }
  }

  return true
})

export default router
