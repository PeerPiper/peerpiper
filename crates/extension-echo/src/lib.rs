#[allow(warnings)]
mod bindings;

use std::fs::OpenOptions;
use std::io::Write;

use bindings::{
    component::extension::peer_piper_commands,
    component::extension::types::{Error, Message},
    exports::component::extension::handlers::Guest,
};

struct Component;

impl Guest for Component {
    /// Say hello!
    fn handle_message(msg: Message) -> Result<String, Error> {
        // topic: String, peer: String, data: Vec<u8>
        let Message { topic, peer, data } = msg;

        let phrase = format!("Hello, {peer}! You sent me: {data:?} about topic {topic:?}");

        // if the log file does not exist, create it.  if the log file exists, append the phrase to the end of the file
        let mut file = OpenOptions::new()
            .append(true)
            .create(true)
            .open("log.txt")
            .map_err(|e| Error::IoError(e.to_string()))?;

        writeln!(file, "{}", phrase).map_err(|e| Error::IoError(e.to_string()))?;

        println!("{}", phrase);

        Ok(phrase)
    }

    /// Respond to a request with the given bytes
    fn handle_request(data: Vec<u8>) -> Result<Vec<u8>, Error> {
        println!("Received request: {:?}", data);
        // peer_piper_commands::start_providing(&data);
        Ok(data)
    }
}

bindings::export!(Component with_types_in bindings);
