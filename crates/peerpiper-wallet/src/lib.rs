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
mod bindings;

mod state;

use state::State;

use crate::bindings::exports::peerpiper::wallet::wurbo_out::Guest as WurboGuest;
use crate::bindings::peerpiper::wallet::wurbo_in::set_hash;
use crate::bindings::peerpiper::wallet::wurbo_types::{self, Context, Message};

// use bindings::example::edwards_ui;
use bindings::delano;
use bindings::exports::peerpiper::wallet::aggregation::Guest as AggregationGuest;
use bindings::seed_keeper::wit_ui;

use wurbo::jinja::{error::RenderError, Entry, Index, Rest, Templates};
use wurbo::prelude::*;

use base64ct::{Base64UrlUnpadded, Encoding};
use std::ops::Deref;

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
                rendered
            }
            // The syntax is Context::SlotName(inner_ctx) ...
            Context::Seed(ctx) => wit_ui::wurbo_out::render(&ctx.into())?,
            Context::Delano(ctx) => delano::wit_ui::wurbo_out::render(&ctx.into())?,
            // Context::Edwards(ctx) => edwards_ui::wurbo_out::render(&ctx.into())?,
            Context::Event(evt) => match evt {
                Message::Encrypted(seed) => {
                    // We can do things with the encrypted seed here
                    // Like push to the URL, or save to local storage, or the network
                    println!("Received Context Event Message Encrypted seed {:?}", seed);
                    let state = State::default().with_encrypted(seed);
                    // convert to json string and set hash to it
                    let hash_val = serde_json::to_string(&state).map_err(|e| e.to_string())?;
                    let hash_b64 = Base64UrlUnpadded::encode_string(hash_val.as_bytes());
                    set_hash(&hash_b64);
                    // return no html
                    "".to_string()
                }
            },
        };
        Ok(html)
    }

    /// No-op for activate(). This is here because the wurbo API calls activate in the library,
    /// and if this is missing there's a console error. It is benign, but it's annoying.
    fn activate() {}
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
}

impl StructObject for AppContext {
    fn get_field(&self, name: &str) -> Option<Value> {
        match name {
            "app" => Some(Value::from_struct_object(self.app.clone())),
            "seed_ui" => Some(Value::from_struct_object(self.seed_ui.clone())),
            "delano_ui" => Some(Value::from_struct_object(self.delano_ui.clone())),
            // "edwards_ui" => Some(Value::from_struct_object(self.edwards_ui.clone())),
            _ => None,
        }
    }
    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&[
            "app", "seed_ui",
            // "edwards_ui"
        ])
    }
}

/// We have all the content, convert it to AppContext
impl From<wurbo_types::Content> for AppContext {
    fn from(context: wurbo_types::Content) -> Self {
        AppContext {
            app: App::from(context.app),
            // We pass props since initial content could have the encrypted seed for the seed keeper
            seed_ui: SeedUI::from(context.seed_ui),
            delano_ui: DelanoUI::from(context.delano_ui),
            // We could have an initial message to sign or verify too...
            // edwards_ui: Edwards::from(context.edwards_ui),
        }
    }
}

// Some App properties
#[derive(Debug, Clone)]
pub(crate) struct App(wurbo_types::App);

impl StructObject for App {
    fn get_field(&self, name: &str) -> Option<Value> {
        match name {
            "title" => Some(Value::from(self.title.clone())),
            "id" => Some(Value::from(utils::rand_id())),
            _ => None,
        }
    }
    /// So that debug will show the values
    fn static_fields(&self) -> Option<&'static [&'static str]> {
        Some(&["title", "id"])
    }
}

impl From<wurbo_types::App> for App {
    fn from(context: wurbo_types::App) -> Self {
        App(context)
    }
}

impl Deref for App {
    type Target = wurbo_types::App;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Wrapper around the seed keeper context so we can implement StructObject on top of it
#[derive(Debug, Clone)]
struct SeedUI(wurbo_types::SeedContext);

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
    type Target = wurbo_types::SeedContext;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// DelanoUI is the context for the Delano user interface component
#[derive(Debug, Clone)]
struct DelanoUI(wurbo_types::DelanoContext);

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
    type Target = wurbo_types::DelanoContext;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

// #[derive(Debug, Clone)]
// struct Edwards(wurbo_types::EdwardsContext);
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
//     type Target = wurbo_types::EdwardsContext;
//
//     fn deref(&self) -> &Self::Target {
//         &self.0
//     }
// }
