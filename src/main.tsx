import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Применяем полифиллы для совместимости с разными браузерами
import { BrowserCompatibility } from "./lib/browser-compatibility";
BrowserCompatibility.applyPolyfills();

createRoot(document.getElementById("root")!).render(<App />);
