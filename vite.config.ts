import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Aumenta el umbral del aviso (algunos chunks de vendor son grandes por
    // naturaleza, p. ej. react-pdf). Sin esto Vite mete todo en un único bundle.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Divide librerías pesadas en chunks independientes para que el
        // navegador las descargue en paralelo y las cachee por separado entre
        // despliegues. Reduce el JS crítico del login y acelera el TTI.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
            "@radix-ui/react-accordion",
          ],
          "charts": ["recharts"],
          "pdf": ["@react-pdf/renderer", "jspdf", "html2canvas"],
          "xlsx": ["xlsx"],
          "icons": ["lucide-react"],
          "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "query": ["@tanstack/react-query"],
          "date": ["date-fns"],
        },
      },
    },
  },
}));
