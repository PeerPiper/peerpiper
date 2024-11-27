pub mod error;
mod pluggable;
mod plugin;

pub use pluggable::{ExternalEvents, PluggablePiper, PluginLoader};
pub use plugin::{Environment, Inner, Plugin};
