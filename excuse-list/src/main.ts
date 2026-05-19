import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

localStorage.removeItem('untis_jwt')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
