pub mod error;
mod pluggable;
mod plugin;

pub use pluggable::{ExternalEvents, PluggableClient, PluggablePiper};
pub use plugin::{Environment, Inner, Plugin};
