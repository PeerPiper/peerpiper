#[allow(warnings)]
mod bindings;

use bindings::exports::component::extension::handlers::Guest;

struct Component;

impl Guest for Component {
    /// Say hello!
    fn handle_message(topic: String, peer: String, data: Vec<u8>) -> String {
        format!("Hello, {peer}! You sent me: {data:?} about topic {topic:?}")
    }
}

bindings::export!(Component with_types_in bindings);
