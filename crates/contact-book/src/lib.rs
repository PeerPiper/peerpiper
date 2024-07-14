#[allow(warnings)]
mod bindings;
mod contacts;
mod countries;
mod state;

use std::sync::OnceLock;

use bindings::component::contact_book::{
    context_types::{Context, Initial},
    wurbo_in,
};
use bindings::exports::component::contact_book::wurbo_out::Guest as WurboGuest;
use state::{Loaded, State};
use wurbo::jinja::{Entry, Index, Rest, Templates};
use wurbo::prelude_bindgen;

const INDEX_HTML: &str = "index.html";
const OUTPUT_HTML: &str = "output.html";
const CARD_HTML: &str = "card.html";
static APP_ID: OnceLock<String> = OnceLock::new();

/// We need to provide the templates for the macro to pull in
fn get_templates() -> Templates {
    let templates = Templates::new(
        Index::new(INDEX_HTML, include_str!("templates/index.html")),
        Entry::new(OUTPUT_HTML, include_str!("templates/output.html")),
        Rest::new(vec![
            Entry::new(CARD_HTML, include_str!("templates/card.html")),
            Entry::new("upload.html", include_str!("templates/upload.html")),
        ]),
    );
    templates
}

// Macro builds the Component struct and implements the Guest trait for us, saving copy-and-paste
prelude_bindgen! {WurboGuest, Component, StructContext, Context, LAST_STATE}

struct Component;

bindings::export!(Component with_types_in bindings);

#[derive(Debug, Clone, Default)]
struct StructContext {
    state: State,
    target: Option<String>,
}

impl StructContext {
    /// with this target template, instead of defaulting to entry or output template
    fn with_target(mut self, target: String) -> Self {
        self.target = Some(target);
        self
    }
}

impl Object for StructContext {
    /// Remember to add match arms for any new fields.
    fn get_value(self: &std::sync::Arc<Self>, key: &Value) -> Option<Value> {
        match key.as_str()? {
            // Fixed id for the app, LazyLock
            "app_id" => Some(Value::from(APP_ID.get_or_init(|| rand_id()).to_owned())),
            "id" => Some(Value::from(rand_id())),
            "state" => Some(Value::from_object(self.state.clone())),
            "country_ids" => Some(Value::from(countries::country_ids())),
            _ => None,
        }
    }
}

/// The Router that converts the given context into a StructContext based on the app logic.
impl From<&Context> for StructContext {
    fn from(context: &Context) -> Self {
        match context {
            Context::AllContent(initial) => StructContext::from(initial.clone()),
            Context::Buildcontact(detail) => {
                StructContext::from(State::from_latest().update_contact(detail.clone()))
                    .with_target(OUTPUT_HTML.to_string())
            }
            Context::Submitnewcontact => {
                StructContext::from(State::from_latest().submit_new_contact())
                    // set target to entire page to show all new results
                    .with_target(INDEX_HTML.to_string())
            }
            // Handle uplaoded CSV COntacts
            Context::Upload(file_details) => StructContext::from(
                State::from_latest().upload_contacts(file_details.bytes.clone()),
            )
            .with_target(INDEX_HTML.to_string()),
            // emit an Invite for this Contact id
            Context::Invite(id) => {
                StructContext::from(State::from_latest().emit_invite(id.clone()))
            }
        }
    }
}

impl From<State> for StructContext {
    fn from(state: State) -> Self {
        let mut last = { LAST_STATE.lock().unwrap().clone().unwrap_or_default() };
        last.state = state;
        last
    }
}

impl From<Initial> for StructContext {
    fn from(initial: Initial) -> Self {
        // persist the last state, if any
        let last = { LAST_STATE.lock().unwrap().clone().unwrap_or_default() };
        let state = match last.state.loaded {
            // If previous state loaded None, then use the current state loaded
            Loaded::None => State::from(initial.load),
            // If previous state loaded anything, then use the previous state loaded
            _ => State {
                loaded: last.state.loaded,
                ..State::from(initial.load)
            },
        };

        StructContext {
            state,
            ..Default::default()
        }
    }
}

impl From<contacts::Contact> for StructContext {
    fn from(contact: contacts::Contact) -> Self {
        StructContext {
            state: State {
                builder: contact,
                ..Default::default()
            },
            ..Default::default()
        }
    }
}
