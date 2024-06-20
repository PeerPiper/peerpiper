build-inner:
  cd inner-app && npm run build

dev: build-inner
  npm run dev -- --open
 
build: build-inner
   npm run build

preview: build
  npm run preview -- --open

# Subresource Integrity Check
sri:
  cat static/innerApp.js | openssl dgst -sha256 -binary | openssl base64 -A
