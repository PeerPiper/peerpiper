// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::stream::StreamExt;
use futures::SinkExt;
use log::{debug, info};
use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use peerpiper::core::events::{NetworkEvent, PeerPiperCommand};
use std::collections::HashMap;

use std::sync::{Arc, Mutex};

use tauri::api::process::{Command, CommandEvent};
// use tauri::async_runtime::block_on;
use tauri::async_runtime::Mutex as AsyncMutex;
use tauri::Manager;
use tauri::State;

use std::env;
use tokio::sync::mpsc;

struct AsyncProcInputTx {
    // This is how we communicate with the streaming chat
    inner: AsyncMutex<mpsc::Sender<Signal>>,

    // Whether we should stop the chat or not
    flag: AsyncMutex<bool>,
}

// Tauri plug-ins
use tauri_plugin_log::LogTarget;

// This package
mod utils;

/// The various output types that this app can generate.
enum Signal {
    ChatToken(String),
    RequestMultiaddr,
}

/// This is the global connection to Ollama
struct DbConnection {
    llama: Arc<AsyncMutex<Option<Ollama>>>,
    ollama_port: Mutex<Option<u16>>,
}

#[tauri::command(rename_all = "snake_case")]
async fn tauri_init_command(
    connection: State<'_, DbConnection>,
    app_handle: tauri::AppHandle,
    // name: &str,
) -> Result<(), String> {
    // Start the ollama when we receive this call
    let ollama_port = {
        let ollama_port_guard = connection.ollama_port.lock().unwrap();
        *ollama_port_guard.as_ref().unwrap()
    };

    app_handle.emit_all("loading_ollama", "").unwrap();
    *connection.llama.lock().await = Some(Ollama::new("http://127.0.0.1".to_string(), ollama_port));
    app_handle.emit_all("loaded_ollama", ollama_port).unwrap();

    Ok(())
}
#[tauri::command(rename_all = "snake_case")]
async fn start_chat(
    question: String,
    context: String,
    state: tauri::State<'_, AsyncProcInputTx>,
    connection: tauri::State<'_, DbConnection>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    info!("{}", question);

    // reset the flag, because we answer a new question
    *state.flag.lock().await = false;

    let mut temp = connection.llama.lock().await;
    let llama3 = temp.as_mut().unwrap();

    let model = "llama3:latest".to_string();
    let prompt = format!("{} Answer based on this context: {}", question, context);

    let generation_request = GenerationRequest::new(model, prompt);
    let mut stream = llama3.generate_stream(generation_request).await.unwrap();
    while let Some(res) = stream.next().await {
        let async_proc_input_tx = state.inner.lock().await;
        let flag = *state.flag.lock().await;

        if flag {
            break;
        }

        match res {
            Ok(responses) => {
                // info!("responses: {:?}", responses);
                for resp in responses {
                    let _ = async_proc_input_tx
                        .send(Signal::ChatToken(resp.response))
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            Err(err) => {
                panic!("{:?}", err);
            }
        }
    }

    chat_finished(&app_handle);

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
async fn stop_chat(state: tauri::State<'_, AsyncProcInputTx>) -> Result<(), String> {
    info!("stop_chat");

    *state.flag.lock().await = true;

    Ok(())
}

/// Short for JavaScript to Rust.
/// This is the function that receives messages from the frontend
#[tauri::command]
async fn client_ready(state: tauri::State<'_, AsyncProcInputTx>) -> Result<(), String> {
    debug!("client_ready");
    let async_proc_input_tx = state.inner.lock().await;
    async_proc_input_tx
        .send(Signal::RequestMultiaddr)
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    // I/O with the frontend
    let (async_proc_input_tx, async_proc_input_rx) = mpsc::channel(1);
    let (async_proc_output_tx, mut async_proc_output_rx) = mpsc::channel(1);

    // I/O with the peerpiper node
    let (pp_tx, mut pp_rx) = futures::channel::mpsc::channel::<NetworkEvent>(8);
    let (mut commander, command_receiver) = futures::channel::mpsc::channel::<PeerPiperCommand>(8);

    let log = tauri_plugin_log::Builder::default()
        .targets([
            LogTarget::Folder(utils::app_root()),
            LogTarget::Stdout,
            LogTarget::Webview,
        ])
        .level(log::LevelFilter::Debug);

    let (ollama_port, _child) = spawn_ollama("ollama");

    tauri::Builder::default()
        .manage(DbConnection {
            llama: Default::default(),
            ollama_port: Mutex::new(Some(ollama_port)),
        })
        .manage(AsyncProcInputTx {
            inner: AsyncMutex::new(async_proc_input_tx),
            flag: AsyncMutex::new(false),
        })
        .plugin(log.build())
        .setup(|app| {
            // The app does not work started from a graphical shell, because it starts in `/` by default
            env::set_current_dir(dirs::home_dir().unwrap()).unwrap();

            // Setup the async chat
            tauri::async_runtime::spawn(async move {
                async_process_model(async_proc_input_rx, async_proc_output_tx).await
            });

            tauri::async_runtime::spawn(async move {
                peerpiper::start(pp_tx, command_receiver).await.unwrap();
            });

            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                // loop over select of 
                // 1) if let Some(event) = pp_rx.next().await {
                // 2) if let Some(output) = async_proc_output_rx.recv().await
                loop {
                    tokio::select! {
                        Some(event) = pp_rx.next() => {
                            match event {
                                NetworkEvent::ConnectionClosed { peer, cause } => {
                                    info!("ConnectionClosed: {:?} {:?}", peer, cause);
                                    app_handle.emit_all("connectionClosed", peer).unwrap();
                                }
                                NetworkEvent::ListenAddr { address, .. } => {
                                    app_handle.emit_all("serverMultiaddr", address.to_string()).unwrap();
                                }
                                // TODO: Handle LLM Generation requests from the network
                                _ => {}
                            }
                        }
                        Some(output) = async_proc_output_rx.recv() => {
                            match output {
                                Signal::ChatToken(output) => chat_token(output, &app_handle),
                                Signal::RequestMultiaddr => {
                                    let _ = commander
                                        .send(PeerPiperCommand::ShareAddress)
                                        .await
                                        .map_err(|e| e.to_string());

                                    let address: String = loop {
                                        if let Some(event) = pp_rx.next().await {
                                            if let NetworkEvent::ListenAddr { address, .. } = event {
                                                break address.to_string();
                                            }
                                        }
                                    };

                                    app_handle.emit_all("serverMultiaddr", address).unwrap()
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tauri_init_command,
            start_chat,
            stop_chat,
            client_ready
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn chat_token<R: tauri::Runtime>(message: String, manager: &impl Manager<R>) {
    info!("{}", message);
    manager.emit_all("chatToken", message).unwrap();
}

fn chat_finished<R: tauri::Runtime>(manager: &impl Manager<R>) {
    manager.emit_all("chatFinished", ()).unwrap();
}

fn extract_ollama_port(line: String) -> Option<String> {
    // gets the port from pattern "Listening on 127.0.0.1:(\d+)"
    // without using regex, splits on : char
    // Check that line contains "Listening on "
    // should take a line like: "2024/04/30 20:28:06 routes.go:950: INFO Listening on 127.0.0.1:42675 (version 0.1.22)"
    // and return "42675"
    // or None if it doesn't match the pattern
    // ensure it only uses the port after "Listening on" phrase, drop everything after any space
    // after the port number
    let parts: Vec<&str> = line.split("Listening on 127.0.0.1:").collect();
    if parts.len() > 1 {
        let port = parts[1].split_whitespace().collect::<Vec<&str>>()[0];
        Some(port.to_string())
    } else {
        None
    }
}

fn spawn_ollama(ollama_name: &str) -> (u16, tauri::api::process::CommandChild) {
    // Setup ollama
    let mut ollama_port: u16 = 0;

    info!("Starting Ollama");
    let host = "127.0.0.1:0".to_string();
    let mut envs: HashMap<String, String> = HashMap::new();
    envs.insert("OLLAMA_HOST".to_string(), host);

    let (mut rx, child) = Command::new_sidecar(ollama_name)
        .unwrap_or_else(|_| panic!("failed to create `{}` binary command", ollama_name))
        .envs(envs)
        .args(["serve"])
        .spawn()
        .unwrap_or_else(|_| panic!("Failed to spawn {}", ollama_name));

    while let Some(event) = rx.blocking_recv() {
        if let CommandEvent::Stderr(line) = event {
            match extract_ollama_port(line.clone()) {
                Some(port) => {
                    ollama_port = port.parse::<u16>().unwrap();
                    break;
                }
                None => info!("Cannot tell ollama port from this log line"),
            }
            info!("{}", line);
        }
    }

    info!("The ollama_port is definitely {:?}", ollama_port);
    println!("The ollama_port is definitely {:?}", ollama_port);

    // keep the program running
    tauri::async_runtime::spawn(async move {
        // read events such as stdout
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stderr(line) = event {
                info!("{}", line);
            }
        }
    });

    (ollama_port, child)
}

async fn async_process_model(
    mut input_rx: mpsc::Receiver<Signal>,
    output_tx: mpsc::Sender<Signal>,
    // piper_sendr: futures::channel::mpsc::Sender<PeerPiperCommand>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    while let Some(input) = input_rx.recv().await {
        let output = input;
        output_tx.send(output).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "spawns a ollama in a thread that never gets shut down"]
    /// Postgres test database creation, querying and destructuring
    async fn test_ollama() {
        use log::info;
        use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
        use std::process::Command;
        use std::thread;

        // Serve ollama first: if target is linux
        if cfg!(target_os = "linux") {
            let file_path = std::env::current_dir()
                .unwrap()
                .join("ollama-x86_64-unknown-linux-gnu");

            // call using Rust command in OS spawned thread
            thread::spawn(move || {
                Command::new(file_path)
                    .arg("serve")
                    .spawn()
                    .expect("failed to start ollama");
            });
        } else {
            panic!("Unsupported OS");
        }

        // By default it will connect to localhost:11434
        let ollama = Ollama::default();

        let model = "llama3:latest".to_string();
        let prompt = "Why is the sky blue?".to_string();

        let res = ollama
            .generate(GenerationRequest::new(model, prompt))
            .await
            .unwrap();
        eprintln!("{}", res.response);
        info!("{}", res.response);
    }

    #[test]
    fn test_extract_ollama_port() {
        let line =
            "2024/04/30 20:28:06 routes.go:950: INFO Listening on 127.0.0.1:42675 (version 0.1.22)"
                .to_string();

        let port = extract_ollama_port(line);
        assert_eq!(port, Some("42675".to_string()));
    }
}
