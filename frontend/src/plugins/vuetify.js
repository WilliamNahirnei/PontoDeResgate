import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import { createVuetify } from 'vuetify'
import { pt } from 'vuetify/locale'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
  },
  // Textos padrão dos componentes (paginação, carregamento, botões lidos pelo
  // leitor de tela) em português (REQUISITOS.md §1.1).
  locale: {
    locale: 'pt',
    messages: { pt },
  },
})
