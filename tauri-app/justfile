tauri:
  npm run tauri dev

install_ollama:
  echo "Installing ollama"
  # wget https://github.com/jmorganca/ollama/releases/download/v0.1.20/ollama-darwin
  wget https://github.com/ollama/ollama/releases/download/v0.1.22/ollama-linux-amd64
  chmod +x ollama-linux-amd64
  # Tauri needs this specific name
  mv ollama-linux-amd64 src-tauri/ollama-x86_64-unknown-linux-gnu 
