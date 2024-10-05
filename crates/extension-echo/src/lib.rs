#[allow(warnings)]
mod bindings;

use bindings::{
    component::extension::types::Message, exports::component::extension::handlers::Guest,
};

struct Component;

impl Guest for Component {
    /// Say hello!
    fn handle_message(msg: Message) -> String {
        // topic: String, peer: String, data: Vec<u8>
        let Message { topic, peer, data } = msg;
        format!("Hello, {peer}! You sent me: {data:?} about topic {topic:?}")
    }
}

bindings::export!(Component with_types_in bindings);
