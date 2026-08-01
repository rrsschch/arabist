import '@fontsource-variable/inter'
import '@fontsource-variable/noto-naskh-arabic'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TelegramProvider } from './telegram'
import { App } from './App'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TelegramProvider><App /></TelegramProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
