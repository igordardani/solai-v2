import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// ─────────────────────────────────────────────────────────────────────────────
// ATENÇÃO: removido o bloco `define: { 'process.env.GEMINI_API_KEY': ... }`
//
// Esse bloco injetava a chave diretamente no bundle JavaScript público,
// expondo-a para qualquer pessoa via DevTools → Sources → bundle.js.
//
// A chave agora vive APENAS em:
//   - Vercel → Settings → Environment Variables → GEMINI_API_KEY
//   - É lida server-side em /api/process-pdf.ts via process.env.GEMINI_API_KEY
//   - Nunca chega ao browser.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
  },
});
