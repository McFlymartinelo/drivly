import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { seedIfEmpty } from "./db/seed.ts"
import "./index.css"

async function boot() {
  await seedIfEmpty()
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
