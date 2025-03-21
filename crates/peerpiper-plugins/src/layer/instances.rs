use std::sync::{Arc, RwLock};

use super::{Error, Inner, State};
use crate::layer::platform::{runtime_layer, spawn, SystemTime};

use peerpiper::{core::events::SystemCommand, PeerPiper, ReturnValues};
use wasm_component_layer::{
    AsContext as _, AsContextMut, Component, Engine, ExportInstance, Func, FuncType, Instance,
    Linker, List, ListType, Record, RecordType, ResourceOwn, ResourceType, Store, Value, ValueType,
    Variant, VariantCase, VariantType,
};

/// the name component
pub const COMPONENT: &str = "plugin";
/// [constuctor]
pub const CONSTRUCTOR: &str = "[constructor]";
/// [method]
pub const METHOD: &str = "[method]";
/// The interface name
pub const INTERFACE: &str = "component:plugin/run";

type PollableResource = Arc<RwLock<Option<ReturnValues>>>;

pub struct LayerPlugin {
    pub(crate) store: Store<State, runtime_layer::Engine>,
    instance: Instance,
    /// The constucted component
    component_resource: Option<ResourceOwn>,
}

impl LayerPlugin {
    /// Creates a new with the given wallet layer as a dependency
    pub fn new(bytes: &[u8], data: State, peerpiper: PeerPiper) -> Self {
        let (instance, store) = instantiate_instance(bytes, data, peerpiper);

        Self {
            store,
            instance,
            component_resource: None,
        }
    }

    fn interface(&self) -> Result<&ExportInstance, Error> {
        self.instance
            .exports()
            .instance(&INTERFACE.try_into()?)
            .ok_or(Error::InstanceNotFound)
    }

    pub fn store(&self) -> &Store<State, runtime_layer::Engine> {
        &self.store
    }

    pub fn store_mut(&mut self) -> &mut Store<State, runtime_layer::Engine> {
        &mut self.store
    }

    pub fn call(&mut self, name: &str, arguments: &[Value]) -> Result<Option<Value>, Error> {
        tracing::trace!("Calling function: {}", name);

        let func = self
            .interface()?
            .func(name)
            .ok_or_else(|| Error::FuncNotFound(name.to_string()))?;

        let func_result_len = func.ty().results().len();
        //let binding = func.ty();
        //let func_result_ty = binding.results().first().unwrap_or(&ValueType::Bool);
        let mut results = vec![Value::Bool(false); func_result_len];
        func.call(&mut self.store, arguments, &mut results)
            .map_err(|e| {
                tracing::error!("Error calling function: {:?}", e);
                e
            })?;

        if results.is_empty() {
            Ok(None)
        } else {
            Ok(Some(results.remove(0)))
        }
    }

    /// Constructs
    pub fn construct(&mut self) -> Result<(), Error> {
        let constructor = self
            .interface()?
            .func(format!("{CONSTRUCTOR}{COMPONENT}"))
            .ok_or(Error::FuncNotFound(format!("{CONSTRUCTOR}{COMPONENT}")))?;

        let func_result_len = constructor.ty().results().len();
        let mut results = vec![Value::Bool(false); func_result_len];

        constructor
            .call(&mut self.store, &[], &mut results)
            .map_err(|e| {
                tracing::error!("Error calling constructor: {:?}", e);
                e
            })?;

        let component_resource = match &results[0] {
            Value::Own(resource) => resource,
            _ => {
                return Err(Error::ResourceNotFound(
                    format!("{CONSTRUCTOR}{COMPONENT}").to_string(),
                ))
            }
        };

        //let borrowed_component = component_resource
        //    .borrow(self.store.as_context_mut())
        //    .map_err(|e| {
        //        tracing::error!("Error getting borrowed component: {:?}", e);
        //        e
        //    })?;

        // This resource needs to be saved so we can borrow it to call its methods
        self.component_resource = Some(component_resource.clone());

        Ok(())
    }

    /// Call this method name on the constructed component
    /// Erros if the component has not been constructed yet
    pub fn call_method(&mut self, name: &str, args: &[Value]) -> Result<Option<Value>, Error> {
        tracing::debug!("Calling method: {}", name);
        let component_resource = match &self.component_resource {
            Some(resource) => resource,
            None => {
                tracing::error!("Component not constructed yet");
                return Err(Error::ResourceNotFound("component".to_string()));
            }
        };

        let borrowed_component = component_resource
            .borrow(self.store.as_context_mut())
            .map_err(|e| {
                tracing::error!("Error getting borrowed component: {:?}", e);
                e
            })?;

        // prepend borrowed_component to the arguments
        let mut arguments: Vec<wasm_component_layer::Value> =
            vec![Value::Borrow(borrowed_component)];
        arguments.extend_from_slice(args);

        let func = self
            .interface()?
            .func(format!("{METHOD}{COMPONENT}.{name}"))
            .ok_or_else(|| Error::FuncNotFound(name.to_string()))?;

        let func_result_len = func.ty().results().len();
        let mut results = vec![Value::Bool(false); func_result_len];

        func.call(&mut self.store, &arguments, &mut results)
            .map_err(|e| {
                tracing::error!("Error calling method: {:?}", e);
                e
            })?;

        tracing::debug!("Results from {}: {:?}", name, results);

        if results.is_empty() {
            Ok(None)
        } else {
            Ok(Some(results.remove(0)))
        }
    }
}

/// Builds an instantiated Plugin.
/// By default, adds in all the peerpiper commands, but
/// returns a [Linker] which can be used to link more host functions,
/// before the final `build` call which returns the instance and the store.
pub struct InstanceBuilder {
    linker: Linker,
    store: Store<State, runtime_layer::Engine>,
    component: Component,
}

impl InstanceBuilder {
    /// Creates a new instance builder, which can be used to add host functions
    /// Call `build` to get the final instance and store.
    pub fn new(bytes: &[u8], data: State) -> Self {
        // Create a new engine for instantiating a component.
        let engine = Engine::new(runtime_layer::Engine::default());

        // Create a store for managing WASM data and any custom user-defined state.
        let store = Store::new(&engine, data);

        // Parse the component bytes and load its imports and exports.
        let component = Component::new(&engine, bytes).unwrap();
        // Create a linker that will be used to resolve the component's imports, if any.
        let linker = Linker::default();
        Self {
            linker,
            store,
            component,
        }
    }

    /// Links the given function to the given interface name.
    pub fn link_function(
        &mut self,
        interface_name: &str,
        function_name: &str,
        func: for<'a> fn(&'a mut Store<State, runtime_layer::Engine>) -> Func,
    ) -> Result<(), Error> {
        let linker_instance = self.linker.define_instance(interface_name.try_into()?)?;

        linker_instance.define_func(function_name, func(&mut self.store))?;
        Ok(())
    }

    /// Builds the instance and store
    pub fn build(mut self) -> (Instance, Store<State, runtime_layer::Engine>) {
        (
            self.linker
                .instantiate(&mut self.store, &self.component)
                .unwrap(),
            self.store,
        )
    }
}

pub fn instantiate_instance<T: Inner + Send + 'static>(
    bytes: &[u8],
    data: T,
    peerpiper: PeerPiper,
) -> (Instance, Store<T, runtime_layer::Engine>) {
    // Create a new engine for instantiating a component.
    let engine = Engine::new(runtime_layer::Engine::default());

    // Create a store for managing WASM data and any custom user-defined state.
    let mut store = Store::new(&engine, data);

    // Parse the component bytes and load its imports and exports.
    let component = Component::new(&engine, bytes).unwrap();
    // Create a linker that will be used to resolve the component's imports, if any.
    let mut linker = Linker::default();

    let host_interface = linker
        .define_instance("peerpiper:pluggable/utils".try_into().unwrap())
        .unwrap();

    // new way to ad dlog
    host_interface
        .define_func("log", add_log(&mut store))
        .unwrap();

    host_interface
        .define_func("random-byte", add_random_byte(&mut store))
        .unwrap();

    host_interface
        .define_func("now", add_now(&mut store))
        .unwrap();

    let peerpiper_interface = linker
        .define_instance("peerpiper:pluggable/commands".try_into().unwrap())
        .unwrap();

    // Pollable resource type
    let resource_pollable_ty = ResourceType::new::<PollableResource>(None);

    peerpiper_interface
        .define_resource("pollable", resource_pollable_ty.clone())
        .unwrap();

    peerpiper_interface
        .define_func(
            "order",
            order_command(&mut store, peerpiper, resource_pollable_ty.clone()),
        )
        .unwrap();

    peerpiper_interface
        .define_func(
            "[method]pollable.ready",
            Func::new(
                &mut store,
                FuncType::new(
                    [ValueType::Borrow(resource_pollable_ty.clone())],
                    [ValueType::Bool],
                ),
                move |store, params, results| {
                    tracing::info!("[method]pollable.ready");

                    let Value::Borrow(pollable_resource) = &params[0] else {
                        panic!("Incorrect input type, found {:?}", params[0]);
                    };

                    tracing::info!("Got borrow param pollable {:?}", pollable_resource);

                    let binding = store.as_context();
                    let res_pollable: &PollableResource =
                        pollable_resource.rep(&binding).map_err(|e| {
                            tracing::error!("Error getting pollable resource: {:?}", e);
                            e
                        })?;

                    tracing::info!("Got pollable resource");

                    let ready = res_pollable.read().unwrap().is_some();

                    results[0] = Value::Bool(ready);
                    Ok(())
                },
            ),
        )
        .unwrap();

    // removes and returns the pollable resource
    peerpiper_interface
        .define_func(
            "[method]pollable.take",
            Func::new(
                &mut store,
                FuncType::new(
                    [ValueType::Borrow(resource_pollable_ty.clone())],
                    get_return_values(),
                ),
                move |store, params, results| {
                    tracing::info!("[method]pollable.take");

                    let Value::Borrow(pollable_resource) = &params[0] else {
                        panic!("Incorrect input type, found {:?}", params[0]);
                    };

                    tracing::info!("Got borrow param pollable {:?}", pollable_resource);

                    let binding = store.as_context();
                    let res_pollable: &PollableResource =
                        pollable_resource.rep(&binding).map_err(|e| {
                            tracing::error!("Error getting pollable resource: {:?}", e);
                            e
                        })?;

                    tracing::info!("Got pollable resource");

                    // take the value
                    let mut res_pollable = res_pollable.write().unwrap();
                    let value = res_pollable.take();

                    results[0] = match value {
                        Some(ReturnValues::Data(data)) => Value::Variant(
                            Variant::new(
                                return_variant_type(),
                                0,
                                Some(Value::List(
                                    List::new(
                                        ListType::new(ValueType::U8),
                                        data.iter().map(|b| Value::U8(*b)).collect::<Vec<Value>>(),
                                    )
                                    .unwrap(),
                                )),
                            )
                            .unwrap(),
                        ),
                        Some(ReturnValues::ID(cid)) => Value::Variant(
                            Variant::new(
                                return_variant_type(),
                                1,
                                Some(Value::Record(
                                    Record::new(
                                        cid_record_ty(),
                                        vec![
                                            ("version", Value::U64(cid.version().into())),
                                            ("codec", Value::U64(cid.codec())),
                                            (
                                                "hash",
                                                Value::Record(
                                                    Record::new(
                                                        multihash_record_ty(),
                                                        vec![
                                                            ("code", Value::U64(cid.hash().code())),
                                                            ("size", Value::U8(cid.hash().size())),
                                                            (
                                                                "digest",
                                                                Value::List(
                                                                    List::new(
                                                                        ListType::new(
                                                                            ValueType::U8,
                                                                        ),
                                                                        cid.hash()
                                                                            .digest()
                                                                            .iter()
                                                                            .map(|b| Value::U8(*b))
                                                                            .collect::<Vec<Value>>(
                                                                            ),
                                                                    )
                                                                    .unwrap(),
                                                                ),
                                                            ),
                                                        ],
                                                    )
                                                    .unwrap(),
                                                ),
                                            ),
                                        ],
                                    )
                                    .unwrap(),
                                )),
                            )
                            .unwrap(),
                        ),
                        Some(ReturnValues::Providers(providers)) => Value::Variant(
                            Variant::new(
                                return_variant_type(),
                                2,
                                Some(Value::List(
                                    List::new(
                                        ListType::new(ValueType::String),
                                        providers
                                            .iter()
                                            .map(|p| Value::String(p.to_string().into()))
                                            .collect::<Vec<Value>>(),
                                    )
                                    .unwrap(),
                                )),
                            )
                            .unwrap(),
                        ),
                        None | Some(ReturnValues::None) => {
                            Value::Variant(Variant::new(return_variant_type(), 3, None).unwrap())
                        }
                    };
                    Ok(())
                },
            ),
        )
        .unwrap();

    (linker.instantiate(&mut store, &component).unwrap(), store)
}

/// Adds a log function to the given host_interface
fn add_log<T: Inner>(store: &mut Store<T, runtime_layer::Engine>) -> Func {
    Func::new(
        store,
        FuncType::new([ValueType::String], []),
        move |_store, params, _results| {
            if let Value::String(s) = &params[0] {
                eprintln!("[logging message] {}", s);
                tracing::info!("{}", s);
            }
            Ok(())
        },
    )
}

/// Adds a random_byte function to the given host_interface
fn add_random_byte<T: Inner>(store: &mut Store<T, runtime_layer::Engine>) -> Func {
    Func::new(
        store,
        FuncType::new([], [ValueType::U8]),
        move |_store, _params, results| {
            let random_byte = rand::random::<u8>();
            results[0] = Value::U8(random_byte);
            Ok(())
        },
    )
}

/// Adds a now function to the given host_interface fto get the current time
fn add_now<T: Inner>(store: &mut Store<T, runtime_layer::Engine>) -> Func {
    Func::new(
        store,
        FuncType::new([], [ValueType::S64]),
        move |_store, _params, results| {
            let unix_timestamp = SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            results[0] = Value::S64(unix_timestamp);
            Ok(())
        },
    )
}

/// This function retuns a `Func` that can be used to define the `order` command
pub fn order_command<T: Inner + Send>(
    store: &mut Store<T, runtime_layer::Engine>,
    peerpiper: PeerPiper,
    resource_pollable_ty: ResourceType,
) -> Func {
    let params = get_params();
    let results = [ValueType::Own(resource_pollable_ty.clone())];
    Func::new(
        store,
        FuncType::new(params, results),
        move |mut store, params, results| {
            let resource_pollable: PollableResource = Default::default();
            tracing::debug!("Creating Command resource:");
            let completion_resource = ResourceOwn::new(
                &mut store,
                resource_pollable.clone(),
                resource_pollable_ty.clone(),
            )?;

            // parameter is a single variant
            let command = params_to_command(params);

            if let Some(command) = command {
                let peerpiper = peerpiper.clone();
                //let completion_queue = store.data().completion_queue().clone();
                spawn(async move {
                    if let Ok(result) = peerpiper.order(command.clone()).await {
                        tracing::debug!("Command result: {:?}", result);
                        // store the result in the completion queue
                        // along with the id, which is the command hash
                        //let id = command.request_id();
                        //completion_queue.lock().await.insert(id, result);

                        // update resource_pollable
                        let mut resource_pollable = resource_pollable.write().unwrap();
                        *resource_pollable = Some(result);
                    }
                });
            }
            results[0] = Value::Own(completion_resource);
            Ok(())
        },
    )
}

pub fn params_to_command(params: &[Value]) -> Option<peerpiper::AllCommands> {
    // We build the command based on the variant
    let mut command = None;

    if let Value::Variant(all_commands) = &params[0] {
        match all_commands.ty().cases()[all_commands.discriminant()].name() {
            // match the variant
            "publish" => {
                if let Some(Value::Record(record)) = all_commands.value() {
                    if let Some(Value::String(topic)) = record.field("topic") {
                        if let Some(Value::List(data)) = record.field("data") {
                            let bytes = data
                                .iter()
                                .filter_map(|v| match v {
                                    Value::U8(u) => Some(u),
                                    _ => None,
                                })
                                .collect::<Vec<u8>>();
                            command = Some(peerpiper::AllCommands::Publish {
                                topic: topic.to_string(),
                                data: bytes,
                            });
                        }
                    }
                }
            }
            "subscribe" => {
                if let Some(Value::Variant(subscribe)) = all_commands.value() {
                    if let Some(Value::String(topic)) = subscribe.value() {
                        command = Some(peerpiper::AllCommands::Subscribe {
                            topic: topic.to_string(),
                        });
                    }
                }
            }
            "unsubscribe" => {
                if let Some(Value::Variant(unsubscribe)) = all_commands.value() {
                    if let Some(Value::String(topic)) = unsubscribe.value() {
                        command = Some(peerpiper::AllCommands::Unsubscribe {
                            topic: topic.to_string(),
                        });
                    }
                }
            }
            "system" => {
                if let Some(Value::Variant(system_command)) = all_commands.value() {
                    match system_command.ty().cases()[system_command.discriminant()].name() {
                        "put" => {
                            if let Some(Value::List(data)) = system_command.value() {
                                let bytes = data
                                    .iter()
                                    .filter_map(|v| match v {
                                        Value::U8(u) => Some(u),
                                        _ => None,
                                    })
                                    .collect::<Vec<u8>>();
                                command =
                                    Some(peerpiper::AllCommands::System(SystemCommand::Put {
                                        bytes,
                                    }));
                            }
                        }
                        "put-keyed" => {
                            if let Some(Value::Record(put_record)) = system_command.value() {
                                if let Some(Value::List(key)) = put_record.field("key") {
                                    if let Some(Value::List(value)) = put_record.field("value") {
                                        let key = key
                                            .iter()
                                            .filter_map(|v| match v {
                                                Value::U8(u) => Some(u),
                                                _ => None,
                                            })
                                            .collect::<Vec<u8>>();
                                        let bytes = value
                                            .iter()
                                            .filter_map(|v| match v {
                                                Value::U8(u) => Some(u),
                                                _ => None,
                                            })
                                            .collect::<Vec<u8>>();
                                        command = Some(peerpiper::AllCommands::System(
                                            SystemCommand::PutKeyed { key, bytes },
                                        ));
                                    }
                                }
                            }
                        }
                        "get" => {
                            if let Some(Value::List(data)) = system_command.value() {
                                let bytes = data
                                    .iter()
                                    .filter_map(|v| match v {
                                        Value::U8(u) => Some(u),
                                        _ => None,
                                    })
                                    .collect::<Vec<u8>>();
                                command =
                                    Some(peerpiper::AllCommands::System(SystemCommand::Get {
                                        key: bytes,
                                    }));
                            }
                        }
                        _ => {}
                    }
                }
            }
            "peer-request" => {
                if let Some(Value::Record(peer_request_record)) = all_commands.value() {
                    if let Some(Value::List(request)) = peer_request_record.field("request") {
                        if let Some(Value::String(peer_id)) = peer_request_record.field("peer-id") {
                            let request = request
                                .iter()
                                .filter_map(|v| match v {
                                    Value::U8(u) => Some(u),
                                    _ => None,
                                })
                                .collect::<Vec<u8>>();
                            command = Some(peerpiper::AllCommands::PeerRequest {
                                request,
                                peer_id: peer_id.to_string(),
                            });
                        }
                    }
                }
            }
            "put-record" => {
                tracing::debug!("[layer] Put record");
                if let Some(Value::Record(put_record)) = all_commands.value() {
                    if let Some(Value::List(key)) = put_record.field("key") {
                        if let Some(Value::List(value)) = put_record.field("value") {
                            let key = key
                                .iter()
                                .filter_map(|v| match v {
                                    Value::U8(u) => Some(u),
                                    _ => None,
                                })
                                .collect::<Vec<u8>>();
                            let bytes = value
                                .iter()
                                .filter_map(|v| match v {
                                    Value::U8(u) => Some(u),
                                    _ => None,
                                })
                                .collect::<Vec<u8>>();
                            command = Some(peerpiper::AllCommands::PutRecord { key, value: bytes });
                            tracing::debug!("[layer] Put record: {:?}", command);
                        }
                    }
                }
            }
            "get-record" => {
                if let Some(Value::List(data)) = all_commands.value() {
                    let key = data
                        .iter()
                        .filter_map(|v| match v {
                            Value::U8(u) => Some(u),
                            _ => None,
                        })
                        .collect::<Vec<u8>>();
                    command = Some(peerpiper::AllCommands::GetRecord { key });
                }
            }
            "get-providers" => {
                if let Some(Value::List(data)) = all_commands.value() {
                    let bytes = data
                        .iter()
                        .filter_map(|v| match v {
                            Value::U8(u) => Some(u),
                            _ => None,
                        })
                        .collect::<Vec<u8>>();
                    command = Some(peerpiper::AllCommands::GetProviders { key: bytes });
                }
            }
            "start-providing" => {
                if let Some(Value::List(data)) = all_commands.value() {
                    let bytes = data
                        .iter()
                        .filter_map(|v| match v {
                            Value::U8(u) => Some(u),
                            _ => None,
                        })
                        .collect::<Vec<u8>>();
                    command = Some(peerpiper::AllCommands::StartProviding { key: bytes });
                }
            }

            _ => {}
        }

        //let key = all_commands.ty().cases()[all_commands.discriminant()].name();
    }

    command
}

pub fn list_data() -> ValueType {
    ValueType::List(ListType::new(ValueType::U8))
}

pub fn key_value_ty() -> RecordType {
    RecordType::new(None, vec![("key", list_data()), ("value", list_data())]).unwrap()
}

fn peer_request_record() -> RecordType {
    RecordType::new(
        None,
        vec![("request", list_data()), ("peer-id", ValueType::String)],
    )
    .unwrap()
}

fn system_command_variant() -> VariantType {
    VariantType::new(
        None, // host:component/peerpiper.system-command
        vec![
            VariantCase::new("put", Some(list_data())),
            VariantCase::new("put-keyed", Some(ValueType::Record(key_value_ty()))),
            VariantCase::new("get", Some(list_data())),
        ],
    )
    .unwrap()
}

/// The Function type must match out WIT interface
pub fn get_params() -> impl IntoIterator<Item = ValueType> {
    [ValueType::Variant(
        VariantType::new(
            None,
            vec![
                VariantCase::new(
                    "publish",
                    Some(ValueType::Record(
                        RecordType::new(
                            None,
                            vec![
                                ("topic", ValueType::String),
                                ("data", ValueType::List(ListType::new(ValueType::U8))),
                            ],
                        )
                        .unwrap(),
                    )),
                ),
                VariantCase::new("subscribe", Some(ValueType::String)),
                VariantCase::new("unsubscribe", Some(ValueType::String)),
                VariantCase::new("system", Some(ValueType::Variant(system_command_variant()))),
                VariantCase::new(
                    "peer-request",
                    Some(ValueType::Record(peer_request_record())),
                ),
                VariantCase::new("put-record", Some(ValueType::Record(key_value_ty()))),
                VariantCase::new("get-record", Some(list_data())),
                VariantCase::new("get-providers", Some(list_data())),
                VariantCase::new("start-providing", Some(list_data())),
            ],
        )
        .unwrap(),
    )]
}

pub fn cid_record_ty() -> RecordType {
    RecordType::new(
        None,
        vec![
            ("version", ValueType::U64),
            ("codec", ValueType::U64),
            ("hash", ValueType::Record(multihash_record_ty())),
        ],
    )
    .unwrap()
}

pub fn multihash_record_ty() -> RecordType {
    RecordType::new(
        None,
        vec![
            ("code", ValueType::U64),
            ("size", ValueType::U8),
            ("digest", list_data()),
        ],
    )
    .unwrap()
}

pub fn return_variant_type() -> VariantType {
    VariantType::new(
        None,
        vec![
            VariantCase::new("data", Some(ValueType::List(ListType::new(ValueType::U8)))),
            VariantCase::new("id", Some(ValueType::Record(cid_record_ty()))),
            VariantCase::new(
                "providers",
                Some(ValueType::List(ListType::new(ValueType::String))),
            ),
            VariantCase::new("none", None),
        ],
    )
    .unwrap()
}

pub fn get_return_values() -> impl IntoIterator<Item = ValueType> {
    [ValueType::Variant(return_variant_type())]
}

#[cfg(test)]
mod tests {
    use super::*;

    use peerpiper_native::NativeBlockstoreBuilder;
    use std::ops::Deref as _;
    use tempfile::tempdir;
    use wasm_component_layer::List;

    fn is_normal<T: Sized + Send + Sync + Unpin>() {}

    #[test]
    fn test_is_normal() {
        is_normal::<State>();
        is_normal::<LayerPlugin>();
    }

    #[tokio::test]
    async fn test_plugin() {
        const WASM: &[u8] = include_bytes!(
            "../../../../target/wasm32-unknown-unknown/release/interop_tests_plugin.wasm"
        );

        // should be able to call handle-request on the plugin
        let tempdir = tempdir().unwrap().path().to_path_buf(); // testing only, feel free to use your own path, or the default
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        let peerpiper = PeerPiper::new(blockstore, Default::default());

        let _rx_evts = peerpiper.events().await.unwrap();

        let mut plugin = LayerPlugin::new(WASM, State, peerpiper);

        let bytes = [69, 42, 1, 2, 3];
        let args = vec![Value::List(
            List::new(
                ListType::new(ValueType::U8),
                bytes.iter().map(|b| Value::U8(*b)).collect::<Vec<Value>>(),
            )
            .unwrap(),
        )];

        let result = plugin.call("handle-request", &args);

        eprintln!("Result: {:?}", result);

        assert!(result.is_ok());

        let result = result.unwrap();

        assert!(result.is_some());

        let result = result.unwrap();

        //  We need to check the value of the result, destructure it to chekc if it is a list of
        //  u8,
        //  and then check the values of the list to see if they match the bytes we sent in
        if let Value::Result(result) = result {
            if let Ok(Some(Value::List(list))) = result.deref() {
                let values = list
                    .iter()
                    .filter_map(|v| match v {
                        Value::U8(u) => Some(u),
                        _ => None,
                    })
                    .collect::<Vec<u8>>();

                assert_eq!(values, bytes);
            } else {
                panic!("Mismatch");
            }
        } else {
            panic!("Expected Result, got {:?}", result);
        }
    }
}
