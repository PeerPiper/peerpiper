#![allow(unused_braces)]

cargo_component_bindings::generate!();

mod components;
mod input;
mod output;

use components::page::Page;
use input::Input;
use output::Output;

use crate::bindings::exports::peerpiper::pinger::reactivity::Guest as WurboGuest;
use crate::bindings::peerpiper::pinger::eventerface;
use bindings::Guest;

use render::{
    // A macro to create components
    component,
    // A macro to render components in JSX fashion
    html,
    // A macro to compose components in JSX fashion
    rsx,
    // A trait for custom components
    Render,
};
use wurbo::generate_reactivity;

struct Component;

impl Guest for Component {
    /// Say hello!
    fn hello_world() -> String {
        bindings::peerpiper::pinger::imports::prnt("Printing using importable function");
        "Hello, World!".to_string()
    }
}

generate_reactivity! { WurboGuest, Component, Page, Input, Output, eventerface }
