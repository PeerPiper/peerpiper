cargo_component_bindings::generate!();

use bindings::Guest;

struct Component;

impl Guest for Component {
    /// Say hello!
    fn hello_world() -> String {
        bindings::peerpiper::pinger::imports::prnt("Printing using importable function");
        "Hello, World!".to_string()
    }
}
