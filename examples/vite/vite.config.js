// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: [
        "./",
        "../../../../rust/peerpiper/target/wasm32-wasi/",
      ],
    },
  },
});
