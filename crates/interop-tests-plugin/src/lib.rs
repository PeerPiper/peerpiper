#[allow(warnings)]
mod bindings;

use std::cell::RefCell;

use bindings::exports::component::plugin::run::GuestPlugin;
use bindings::peerpiper::pluggable::commands::{
    order, AllCommands, Pollable, PutRecord, ReturnValues,
};
use bindings::peerpiper::pluggable::utils::log;
use bindings::{
    component::plugin::types::{Error, Message},
    exports::component::plugin::run::Guest,
};

struct Component {
    inner: RefCell<Vec<Pollable>>,
}

impl GuestPlugin for Component {
    fn new() -> Self {
        Self {
            inner: RefCell::new(vec![]),
        }
    }

    fn run_tests(&self) -> String {
        let msg = "[wasm] Running tests.";
        // Order GetRecord for a key.
        log(msg);
        msg.to_string()
    }

    fn put_record(&self, key: Vec<u8>, value: Vec<u8>) {
        // First, order PutRecord for a key. This way the DHT will have a record we can get.
        // We need to wait for confirmation that the DHT has inserted the record.
        let msg = format!(
            "[wasm] Putting record with key: {:?} and value: {:?}",
            key, value
        );
        log(&msg);
        let put_record = PutRecord { key, value };
        let all_command = AllCommands::PutRecord(put_record);

        let pollable = order(&all_command);

        self.inner.borrow_mut().push(pollable);
    }

    // Get Record
    fn get_record(&self, key: Vec<u8>) {
        // Order GetRecord for a key.
        let msg = format!("[wasm] Getting record with key: {:?}", key);
        log(&msg);
        let all_command = AllCommands::GetRecord(key);

        let pollable = order(&all_command);

        self.inner.borrow_mut().push(pollable);
    }

    // tick returns a list of Vec<u8> that are the values of the records that were ordered.
    fn tick(&self) -> Vec<Vec<u8>> {
        let mut ret = vec![];

        for pollable in self.inner.borrow_mut().iter_mut() {
            if pollable.ready() {
                if let ReturnValues::Data(data) = pollable.take() {
                    ret.push(data);
                }
            }
        }

        ret
    }
}

impl Guest for Component {
    type Plugin = Self;

    /// Say hello!
    fn handle_message(msg: Message) -> Result<String, Error> {
        // topic: String, peer: String, data: Vec<u8>
        let Message { topic, peer, data } = msg;

        let phrase = format!("Hello, {peer}! You sent me: {data:?} about topic {topic:?}");

        //// if the log file does not exist, create it.  if the log file exists, append the phrase to the end of the file
        //let mut file = OpenOptions::new()
        //    .append(true)
        //    .create(true)
        //    .open("log.txt")
        //    .map_err(|e| Error::IoError(e.to_string()))?;
        //
        //writeln!(file, "{}", phrase).map_err(|e| Error::IoError(e.to_string()))?;

        println!("{}", phrase);

        Ok(phrase)
    }

    /// Respond to a request with the given bytes
    fn handle_request(data: Vec<u8>) -> Result<Vec<u8>, Error> {
        //println!("Received request: {:?}", data);
        log(&format!("plugin received request: {:?}", data));
        // peer_piper_commands::start_providing(&data);
        Ok(data)
    }
}

bindings::export!(Component with_types_in bindings);
