pub mod error;
mod pluggable;
mod plugin;

pub use pluggable::{PluggablePiper, PluginLoader};
pub use plugin::{Environment, Inner, Plugin};
