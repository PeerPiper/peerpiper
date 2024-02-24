//! The render function here acts more like a Router.
//!
//! During initialization, it takes the context and
//! loads it into each of the child components to render the whole app.
//! Once initialized, it will route updates to the appropriate child component,
//! depending on the context.
//!
//! The structObject impl in this case of the Router should simply call render()
//! on the appropriate child component, which returns a string of HTML, which
//! this router passes through back up to the DOM page.
//!
//! Since the child components are unaware they are in a larger app, the App template needs to
//! wrap the child templates in a larger context variant by specifying a
//! data-attribute tag for the router. This is how the router knows which component to render.
//!
//! Each child component takes care of its own inputs/output, so the Router doesn't
//! need to worry about it.
//!
#![feature(lazy_cell)]

mod bindings;

mod state;

use serde::Deserialize;
use state::State;

use bindings::delano;
use bindings::exports::peerpiper::wallet::aggregation::Guest as AggregationGuest;
use bindings::exports::peerpiper::wallet::wurbo_out::Guest as WurboGuest;
use bindings::peerpiper::wallet::context_types::{
    self, Content, Context, Events, Message, PublishMessage, Seed, SubscribeTopic,
};
use bindings::peerpiper::wallet::wurbo_in;
use bindings::peerpiper::wallet::wurbo_in::set_hash;
use bindings::seed_keeper::wit_ui;
// use bindings::example::edwards_ui;

use wurbo::jinja::{error::RenderError, Entry, Index, Rest, Templates};
use wurbo::prelude::*;

use base64ct::{Base64Url, Base64UrlUnpadded, Encoding};
use peerpiper::core::events::PeerPiperCommand;
use std::ops::Deref;
use std::sync::{LazyLock, Mutex};

static APP_CONTEXT: LazyLock<Mutex<Option<AppContext>>> = LazyLock::new(|| Mutex::new(None));

struct Component;

/// We need to provide the templates for the macro to pull in
fn get_templates() -> Templates {
    Templates::new(
        Index::new("page.html", include_str!("templates/page.html")),
        Entry::new("output.html", include_str!("templates/output.html")),
        Rest::new(vec![]),
    )
}

impl WurboGuest for Component {
    /// Render needs to use the Aggregate Template for the initial load, but after that simply call
    /// render on the child component and pass through the HTML
    fn render(context: Context) -> Result<String, String> {
        let html = match context {
            Context::AllContent(ctx) => {
                // Store the context in the APP_CONTENT, since we don't have &self in this trait
                *APP_CONTEXT.lock().unwrap() = Some(AppContext::from(ctx.clone()));

                render_all(ctx.into()).map_err(|e| e.to_string())?
            }
            // The syntax is Context::SlotName(inner_ctx) ...
            Context::Seed(ctx) => wit_ui::wurbo_out::render(&ctx.into())?,
            Context::Delano(ctx) => delano::wit_ui::wurbo_out::render(&ctx.into())?,
            // Context::Edwards(ctx) => edwards_ui::wurbo_out::render(&ctx.into())?,
            Context::Event(Events::Encrypted(Seed { seed })) => {
                // convert the string to a byte array
                let seed = Base64UrlUnpadded::decode_vec(&seed).map_err(|e| e.to_string())?;

                // We can do things with the encrypted seed here
                // Like push to the URL, or save to local storage, or the network
                let state = State::default().with_encrypted(seed);

                // Set APP_CONTEXT to the new state
                let ctx = {
                    let mut ctx_guard = APP_CONTEXT.lock().unwrap();
                    let app_context = ctx_guard.as_mut().unwrap();
                    app_context.state = state.clone();
                    // drop the lock
                    app_context.clone()
                };

                *APP_CONTEXT.lock().unwrap() = Some(ctx.clone());

                // convert to json string and set hash to it
                let hash_val = serde_json::to_string(&state).map_err(|e| e.to_string())?;
                let hash_b64 = Base64Url::encode_string(hash_val.as_bytes());
                set_hash(&hash_b64);
                // re-render_all using APP_CONTEXT to refresh the screen and show anything that depends on seed
                let res = render_all(ctx.content.clone()).map_err(|e| e.to_string())?;
                res
            }
            Context::Event(Events::Message(Message {
                ref peer,
                ref topic,
                ref data,
            })) => {
                // We can do something with the message here
                println!(
                    "Received NETWORK message: peer: {:#?}, topic: {:#?}",
                    peer, topic
                );
                // We need to pass the data to the appropriate component(s) here
                // TODO: How would we handle it if mulitple components are interested in the message?
                delano::wit_ui::wurbo_out::render(
                    &delano::wit_ui::context_types::Context::Networkevent(
                        delano::wit_ui::context_types::Message {
                            peer: peer.clone(),
                            topic: topic.clone(),
                            data: data.to_vec(),
                        },
                    ),
                )?
            }
            Context::Event(Events::Publish(PublishMessage { key, value })) => {
                // We can do something with the message here
                println!("Received PUBLISH message: key: {:#?}", key);
                // TODO: UI feedback for the user. Toast?

                // Send message to PeerPiper network as pubsub msg.
                // needs to emit stringified peerpiper::core::PeerPiperCommand
                wurbo_in::emit(
                    &serde_json::to_string(&PeerPiperCommand::Publish {
                        topic: key,
                        data: value,
                    })
                    .map_err(|e| e.to_string())?,
                );
                "".to_string()
            }
            Context::Event(Events::Subscribe(SubscribeTopic { key })) => {
                // We can do something with the message here
                println!("Received SUBSCRIBE message: key: {:#?}", key);

                // Send message to PeerPiper network as pubsub msg.
                // needs to emit stringified peerpiper::core::PeerPiperCommand
                wurbo_in::emit(
                    &serde_json::to_string(&PeerPiperCommand::Subscribe { topic: key })
                        .map_err(|e| e.to_string())?,
                );
                "".to_string()
            }
        };
        Ok(html)
    }

    /// No-op for activate(). This is here because the wurbo API calls activate in the library,
    /// and if this is missing there's a console error. It is benign, but it's annoying.
    fn activate(_selectors: Option<Vec<String>>) {}
}

/// Renders all app content into the page
fn render_all(ctx: Content) -> Result<String, String> {
    let templates = get_templates();
    let entry = templates.entry.name;
    let mut env = Environment::new();

    for (name, template) in templates.into_iter() {
        env.add_template(name, template)
            .expect("template should be added");
    }

    let struct_ctx = Value::from_struct_object(AppContext::from(ctx.clone()));

    let prnt_err = |e| {
        println!("Could not render template: {:#}", e);
        let mut err = &e as &dyn std::error::Error;
        while let Some(next_err) = err.source() {
            println!("caused by: {:#}", next_err);
            err = next_err;
        }
        RenderError::from(e)
    };

    let tmpl = env.get_template(entry).map_err(prnt_err)?;
    let rendered = tmpl.render(&struct_ctx).map_err(prnt_err)?;
    Ok(rendered)
}

impl AggregationGuest for Component {
    /// This function is called to activate all the child components of this aggregate component.
    /// It iterates over each of the child components' wurbo_out's and calls activate on each.
    fn activates(selectors: Option<Vec<String>>) {
        wit_ui::wurbo_out::activate(selectors.as_deref());
        delano::wit_ui::wurbo_out::activate(selectors.as_deref());
        // edwards_ui::wurbo_out::activate();
    }
}

/// AppContent is all the content for the entire app. It's comprised of the content of all the
/// components.
#[derive(Debug, Clone)]
pub(crate) struct AppContext {
    app: App,
    seed_ui: SeedUI,
    delano_ui: DelanoUI,
    // edwards_ui: Edwards,
    state: State,
    // Persist the initial loaded content, for when the page is refreshed
    content: Content,
}

impl AppContext {
    /// Create AppContext from the LAST_STATE
    pub fn from_latest() -> Self {
        let binding = APP_CONTEXT.lock().unwrap();
        let last = binding.as_ref().unwrap();
        last.clone()
    }
}

impl StructObject for AppContext {
    fn get_field(&self, name: &str) -> Option<Value> {
        match name {
            "app" => Some(Value::from_struct_object(self.app.clone())),
            "seed_ui" => Some(Value::from_struct_object(self.seed_ui.clone())),
            "delano_ui" => Some(Value::from_struct_object(self.delano_ui.clone())),
            // "edwards_ui" => Some(Value::from_struct_object(self.edwards_ui.clone())),
            "has_seed" => Some(Value::from(self.state.has_encrypted())),
            _ => None,
        }
    }
    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&[
            "app",
            "seed_ui",
            "delano_ui",
            /* "edwards_ui", */ "has_seed",
        ])
    }
}

/// We have all the content, convert it to AppContext
impl From<context_types::Content> for AppContext {
    fn from(context: context_types::Content) -> Self {
        // let last_state = APP_CONTEXT.lock().unwrap() if some, else default if none
        let state = match APP_CONTEXT.lock().unwrap().as_ref() {
            Some(ctx) => ctx.state.clone(),
            None => State::default(),
        };

        AppContext {
            app: App::from(context.app.clone()),
            // We pass props since initial content could have the encrypted seed for the seed keeper
            seed_ui: SeedUI::from(context.seed_ui.clone()),
            delano_ui: DelanoUI::from(context.delano_ui.clone()),
            // We could have an initial message to sign or verify too...
            // edwards_ui: Edwards::from(context.edwards_ui),
            state,
            content: context,
        }
    }
}

// Some App properties
#[derive(Debug, Clone)]
pub(crate) struct App(context_types::App);

impl StructObject for App {
    fn get_field(&self, name: &str) -> Option<Value> {
        match name {
            "title" => Some(Value::from(self.title.clone())),
            "id" => Some(Value::from(rand_id())),
            _ => None,
        }
    }
    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&["title", "id"])
    }
}

impl From<context_types::App> for App {
    fn from(context: context_types::App) -> Self {
        App(context)
    }
}

impl Deref for App {
    type Target = context_types::App;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Wrapper around the seed keeper context so we can implement StructObject on top of it
#[derive(Debug, Clone)]
struct SeedUI(context_types::SeedContext);

/// Implement StructObject for SeedKeeper so that we can use it in the template
/// The main point of this impl is to call render(ctx) on the SeedKeeperUIContext
/// and return the HTML string as the Value
impl StructObject for SeedUI {
    /// Simply passes through the seed context to the component for rendering
    /// outputs to .html
    fn get_field(&self, name: &str) -> Option<Value> {
        let render_result = wit_ui::wurbo_out::render(&self);
        match (name, render_result) {
            ("html", Ok(html)) => Some(Value::from(html)),
            _ => None,
        }
    }

    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&["html"])
    }
}

impl From<wit_ui::wurbo_types::Context> for SeedUI {
    fn from(context: wit_ui::wurbo_types::Context) -> Self {
        SeedUI(context)
    }
}

impl Deref for SeedUI {
    type Target = context_types::SeedContext;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// DelanoUI is the context for the Delano user interface component
#[derive(Debug, Clone)]
struct DelanoUI(context_types::DelanoContext);

/// Implement StructObject for DelanoUI so that we can use it in the template
/// The main point of this impl is to call render(ctx) on the DelanoUIContext
/// and return the HTML string as the Value
impl StructObject for DelanoUI {
    /// Simply passes through the seed context to the component for rendering
    /// outputs to .html
    fn get_field(&self, name: &str) -> Option<Value> {
        let render_result = delano::wit_ui::wurbo_out::render(&self);
        match (name, render_result) {
            ("html", Ok(html)) => Some(Value::from(html)),
            _ => None,
        }
    }

    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&["html"])
    }
}

impl From<delano::wit_ui::context_types::Context> for DelanoUI {
    fn from(context: delano::wit_ui::context_types::Context) -> Self {
        DelanoUI(context)
    }
}

impl Deref for DelanoUI {
    type Target = context_types::DelanoContext;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

// #[derive(Debug, Clone)]
// struct Edwards(context_types::EdwardsContext);
//
// /// Implement StructObject for Edwards so that we can use it in the template
// /// The main point of this impl is to call render(ctx) on the EdwardsUIContext
// /// and return the HTML string as the Value
// impl StructObject for Edwards {
//     fn get_field(&self, name: &str) -> Option<Value> {
//         let render_result = edwards_ui::wurbo_out::render(&self);
//         match (name, render_result) {
//             ("html", Ok(html)) => Some(Value::from(html)),
//             _ => None,
//         }
//     }
//     /// So that debug will show the values
//     fn static_fields(&self) -> Option<&'static [&'static str]> {
//         Some(&["html"])
//     }
// }
//
// impl From<edwards_ui::wurbo_types::Context> for Edwards {
//     fn from(context: edwards_ui::wurbo_types::Context) -> Self {
//         Self(context)
//     }
// }
//
// impl Deref for Edwards {
//     type Target = context_types::EdwardsContext;
//
//     fn deref(&self) -> &Self::Target {
//         &self.0
//     }
// }
