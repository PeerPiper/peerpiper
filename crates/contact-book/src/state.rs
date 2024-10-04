//! Module to hold the sate of this app
use super::LAST_STATE;
use crate::{
    bindings::component::contact_book::{
        context_types::{self, Addctx, Initial, Update},
        wurbo_in,
    },
    contacts::{Contact, ContactList},
};
use wurbo::prelude::{Object, Value};

#[derive(Debug, Clone)]
pub(crate) struct State {
    pub(crate) builder: Contact,
    pub(crate) loaded: Loaded,
    pub(crate) contacts: ContactList,
    pub(crate) profile: Option<Contact>,
}

impl Default for State {
    fn default() -> Self {
        State {
            builder: Contact::default(),
            loaded: Loaded::None,
            contacts: ContactList::default(),
            profile: Default::default(),
        }
    }
}

impl State {
    /// Returns the latest state
    pub(crate) fn from_latest() -> Self {
        let last = { LAST_STATE.lock().unwrap().clone().unwrap_or_default() };
        last.state
    }

    /// Updates the Contact in builder with the given Addctx
    pub(crate) fn build_contact(mut self, addctx: Addctx) -> Self {
        self.builder.update_contact(addctx);
        self
    }

    /// Update a pecific contact given an id and addctx
    pub(crate) fn update_contact(mut self, ctx: Update) -> Self {
        for val in ctx.vals {
            self.contacts.update(&ctx.id, val);
        }
        self
    }

    /// Adds the Contact in builder to the list of contacts in contacts
    pub(crate) fn submit_new_contact(mut self) -> Self {
        // move the self.builder to end of self.contacts Vec
        // In Rust, we can take the value and replace with deault by using std::mem::take
        self.contacts.insert(std::mem::take(&mut self.builder));
        self
    }

    /// Takes the given FileDetails (bytes and filename) and iterates through them, attempts to
    /// parse them into [Contact]
    pub(crate) fn upload_contacts(mut self, input: Vec<u8>) -> Self {
        let mut rdr = csv::Reader::from_reader(input.as_slice());

        // let headers = rdr.headers();
        // println!("HEADERS {:?}", headers);

        for result in rdr.deserialize::<Contact>() {
            if let Ok(mut contact) = result {
                // first remove any extra HashMap entries where the value is empty
                contact.remove_empty_extra();
                self.contacts.insert(contact);
            } else {
                println!("Error parsing CSV, {:?}", result);
            }
        }
        self
    }

    /// Emits the invite
    pub(crate) fn emit_invite(mut self, id: String) -> Self {
        self.contacts.emit_invite(id);
        // TODO: Track that this invite was emited inthe contact state?
        self
    }

    /// Takes the self.builder and emits the data
    pub(crate) fn save_profile(mut self) -> Self {
        self.profile = Some(std::mem::take(&mut self.builder));

        if let Some(profile) = self.profile.as_ref() {
            wurbo_in::emit(&context_types::Message::Profile(profile.clone().into()));
        }
        self
    }
}

impl Object for State {
    /// Remember to add match arms for any new fields.
    fn get_value(self: &std::sync::Arc<Self>, key: &Value) -> Option<Value> {
        match key.as_str()? {
            "builder" => Some(Value::from_object(self.builder.clone())),
            // If hashmap isn't empty, take this HashMap and give it to minijinja
            "contacts" => Some(Value::from_serialize(self.contacts.all())),
            _ => None,
        }
    }
}

impl From<Option<context_types::Initial>> for State {
    fn from(initial: Option<context_types::Initial>) -> Self {
        match initial {
            Some(load) => Self::from(load),
            None => Self::default(),
        }
    }
}

impl From<Initial> for State {
    fn from(initial: Initial) -> Self {
        match initial.load {
            Some(loadables) => Self::from(loadables),
            None => Self::default(),
        }
    }
}

impl From<Option<Vec<context_types::Contact>>> for State {
    fn from(contacts: Option<Vec<context_types::Contact>>) -> Self {
        match contacts {
            Some(loadables) => Self::from(loadables),
            None => Self::default(),
        }
    }
}

impl From<Vec<context_types::Contact>> for State {
    fn from(loadables: Vec<context_types::Contact>) -> Self {
        // iterate over the contacts and convert them to ContactList
        let mut contact_list = ContactList::new();
        for contact in loadables {
            contact_list.insert(contact.into());
        }

        State {
            contacts: contact_list,
            ..Default::default()
        }
    }
}

/// Keeps track of the loaded state
#[derive(Debug, Clone, Default)]
pub(crate) enum Loaded {
    #[default]
    None,
    Contact(context_types::Contact),
    Contacts(Vec<context_types::Contact>),
}
