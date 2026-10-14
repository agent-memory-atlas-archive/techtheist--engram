import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Vue Flow core + addon styles, then our token/Tailwind layer last so our
// theme variables win over the library defaults.
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './assets/app.css'

import App from './App.vue'

// The pane is an app, not a page: no pinch or double-tap zoom on phones.
// iOS Safari ignores user-scalable=no in the viewport meta for pinches, so
// its own gesture events are cancelled too (the canvas zooms itself from
// touch events, which this leaves alone); double-tap zoom is touch-action.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}

createApp(App).use(createPinia()).mount('#app')
