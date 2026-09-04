import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { registerSW } from "virtual:pwa-register"
import App from "./App.tsx"
import { seedIfEmpty } from "./db/seed.ts"
import "./index.css"

registerSW({ immediate: true })

async function boot() {
  await seedIfEmpty()
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
