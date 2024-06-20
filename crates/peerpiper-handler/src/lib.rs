#[allow(warnings)]
mod bindings;

use bindings::exports::peerpiper::handler::handler::{Event, Guest};

struct Component;

impl Guest for Component {
    /// Say hello!
    fn handle(evt: Event) -> String {
        format!("Hello {evt:?}").to_string()
    }
}

bindings::export!(Component with_types_in bindings);
