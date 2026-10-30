import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { ErrorBoundary } from "./components/shared/ErrorBoundary.tsx"
import { ToastHost } from "./components/shared/Toast.tsx"
import { seedIfEmpty } from "./db/seed.ts"
import { initPwa } from "./pwa.ts"
import { ensurePersistentStorage } from "./utils/storage.ts"
import "./index.css"

initPwa()

async function boot() {
  // Persistance du stockage : indispensable pour un carnet tenu des années.
  void ensurePersistentStorage()
  try {
    await seedIfEmpty()
  } catch (error) {
    console.error("Migration des données impossible", error)
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
        <ToastHost />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void boot()
