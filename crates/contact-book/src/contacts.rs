//! The Contact entrie for this Contact Book

use std::collections::HashMap;

use crate::bindings::component::contact_book::{
    context_types::{self, Addctx, Label},
    wurbo_in,
};
use phonenumber::{country::Id, Mode};
use serde::{Deserialize, Serialize};
use wurbo::prelude::{Object, Value};

/// The First Name field could be "Given Name", "First Name" so we use an enum to standardize
/// it into a single field named FirstName
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum FirstName {
    #[serde(rename = "Given Name")]
    GivenName(String),

    /// This is the default field name
    #[serde(rename = "First Name")]
    FirstName(String),
}

impl Default for FirstName {
    fn default() -> Self {
        FirstName::FirstName(String::new())
    }
}

impl From<String> for FirstName {
    fn from(name: String) -> Self {
        FirstName::FirstName(name)
    }
}

impl std::ops::Deref for FirstName {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        match self {
            FirstName::FirstName(name) => name,
            FirstName::GivenName(name) => name,
        }
    }
}

impl From<FirstName> for String {
    fn from(name: FirstName) -> Self {
        match name {
            FirstName::FirstName(name) => name,
            FirstName::GivenName(name) => name,
        }
    }
}

/// The Last name could also be Family Name
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum LastName {
    #[serde(rename = "Family Name")]
    FamilyName(String),

    #[serde(rename = "Last Name")]
    LastName(String),
}

impl Default for LastName {
    fn default() -> Self {
        LastName::LastName(String::new())
    }
}

/// From String for LastName
impl From<String> for LastName {
    fn from(name: String) -> Self {
        LastName::LastName(name)
    }
}

impl std::ops::Deref for LastName {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        match self {
            LastName::LastName(name) => name,
            LastName::FamilyName(name) => name,
        }
    }
}

impl From<LastName> for String {
    fn from(name: LastName) -> Self {
        match name {
            LastName::LastName(name) => name,
            LastName::FamilyName(name) => name,
        }
    }
}

/// Email may also be: email, e-mail, `E-mail 1 - Value`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Email {
    Email(String),
    EMail(String),
    EMail1Value(String),
}

impl Default for Email {
    fn default() -> Self {
        Email::Email(String::new())
    }
}

impl From<String> for Email {
    fn from(email: String) -> Self {
        Email::Email(email)
    }
}

impl std::ops::Deref for Email {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        match self {
            Email::Email(email) => email,
            Email::EMail(email) => email,
            Email::EMail1Value(email) => email,
        }
    }
}

impl From<Email> for String {
    fn from(email: Email) -> Self {
        match email {
            Email::Email(email) => email,
            Email::EMail(email) => email,
            Email::EMail1Value(email) => email,
        }
    }
}

/// Phone may be: phone, mobile, mobile phone, `Mobile 1 - Value`, Phone 1 - Value
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Phone {
    Phone(String),
    Mobile(String),
    MobilePhone(String),
    Mobile1Value(String),
    Phone1Value(String),
}

impl Default for Phone {
    fn default() -> Self {
        Phone::Phone(String::new())
    }
}

impl From<String> for Phone {
    fn from(phone: String) -> Self {
        Phone::Phone(phone)
    }
}

impl std::ops::Deref for Phone {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        match self {
            Phone::Phone(phone) => phone,
            Phone::Mobile(phone) => phone,
            Phone::MobilePhone(phone) => phone,
            Phone::Mobile1Value(phone) => phone,
            Phone::Phone1Value(phone) => phone,
        }
    }
}

impl From<Phone> for String {
    fn from(phone: Phone) -> Self {
        match phone {
            Phone::Phone(phone) => phone,
            Phone::Mobile(phone) => phone,
            Phone::MobilePhone(phone) => phone,
            Phone::Mobile1Value(phone) => phone,
            Phone::Phone1Value(phone) => phone,
        }
    }
}

/// The Message type, so that JavaScript know what type of message it's
/// receiving (Invite, Contacts, etc.)
///
/// WIT requires kebab-case for the enum variants with a tag and val, so we use serde(rename_all)
/// for this, as the invite will likely be passed to another WIT component for processing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[serde(tag = "tag", content = "val")]
pub enum Message {
    Invite(Contact),
    Contacts(Vec<Contact>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct Contact {
    #[serde(default = "wurbo::utils::rand_id")]
    id: String,
    /// Aliases include: "First Name", "Given Name"
    #[serde(alias = "Given Name", alias = "First Name")]
    pub(crate) first_name: Option<String>,
    /// Aliases include: "Family Name"
    #[serde(alias = "Family Name", alias = "Last Name")]
    pub(crate) last_name: Option<String>,
    /// Aliases include: "Email", "E-mail", "E-mail 1 - Value"
    #[serde(alias = "Email", alias = "E-mail", alias = "E-mail 1 - Value")]
    pub(crate) email: Option<String>,
    /// Aliases include: "Phone", "Mobile", "Mobile Phone", "Mobile 1 - Value", "Phone 1 - Value"
    #[serde(
        alias = "Phone",
        alias = "Mobile",
        alias = "Mobile Phone",
        alias = "Mobile 1 - Value",
        alias = "Phone 1 - Value"
    )]
    pub(crate) phone: Option<String>,

    #[serde(flatten)]
    extra: HashMap<String, Value>,

    /// Optional History of the Contact, for example, when the contact was added,
    /// when ivites were sent out, etc.
    #[serde(default)]
    history: Vec<String>,
}

/// Impl From<Contact> for context_types::Contact
impl From<Contact> for context_types::Contact {
    fn from(contact: Contact) -> Self {
        context_types::Contact {
            id: Some(contact.id),
            first_name: contact.first_name.unwrap_or_default(),
            last_name: contact.last_name.unwrap_or_default(),
            email: contact.email.unwrap_or_default(),
            phone: contact.phone.unwrap_or_default(),
        }
    }
}

impl From<Contact> for context_types::Message {
    fn from(contact: Contact) -> Self {
        context_types::Message::Invite(contact.into())
    }
}

impl Default for Contact {
    fn default() -> Self {
        Contact {
            id: wurbo::utils::rand_id(),
            first_name: None,
            last_name: None,
            email: None,
            phone: None,
            extra: Default::default(),
            history: Default::default(),
        }
    }
}

impl Contact {
    pub(crate) fn update_contact(&mut self, addctx: Addctx) {
        match addctx.label {
            Label::FirstName => self.first_name = Some(addctx.value.clone().into()),
            Label::LastName => self.last_name = Some(addctx.value.clone().into()),
            Label::Email => self.email = Some(addctx.value.clone().into()),
            Label::Phone => self.phone = Some(process_phone_number(&addctx.value)),
        }
    }

    /// Removes any extra HashMap entries that are empty
    pub(crate) fn remove_empty_extra(&mut self) {
        self.extra.retain(|_, v| {
            // if not empty String
            if let Some(value) = v.as_str() {
                !value.is_empty()
            } else {
                true
            }
        });
    }
}

impl Object for Contact {
    /// Remember to add match arms for any new fields.
    fn get_value(self: &std::sync::Arc<Self>, key: &Value) -> Option<Value> {
        match key.as_str()? {
            "id" => Some(Value::from(self.id.clone())),
            "first_name" => Some(Value::from(
                self.first_name
                    .as_ref()
                    .map(|name| name.to_string())
                    .unwrap_or_default(),
            )),
            "last_name" => Some(Value::from(
                self.last_name
                    .as_ref()
                    .map(|name| name.to_string())
                    .unwrap_or_default(),
            )),
            "email" => Some(Value::from(
                self.email
                    .as_ref()
                    .map(|email| email.to_string())
                    .unwrap_or_default(),
            )),
            "phone" => Some(Value::from(
                self.phone
                    .as_ref()
                    .map(|phone| phone.to_string())
                    .unwrap_or_default(),
            )),
            "extra" => Some(Value::from_object(self.extra.clone())),
            _ => None,
        }
    }
}

impl From<Contact> for Value {
    fn from(contact: Contact) -> Self {
        Value::from_object(contact)
    }
}

impl From<context_types::Contact> for Contact {
    fn from(contact: context_types::Contact) -> Self {
        Contact {
            id: contact.id.map_or_else(wurbo::utils::rand_id, |id| id),
            first_name: Some(contact.first_name.into()),
            last_name: contact.last_name.into(),
            email: contact.email.into(),
            phone: contact.phone.into(),
            extra: Default::default(),
            history: Default::default(),
        }
    }
}

/// ContactList is our list of contacts. Can be sorted or lookup up by id or other fields (first_name, last_name, email, phone)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct ContactList {
    contacts: HashMap<String, Contact>,
}

impl ContactList {
    /// Creates a new ContactList
    pub(crate) fn new() -> Self {
        ContactList {
            contacts: Default::default(),
        }
    }

    /// Whether the ContactList is empty
    pub(crate) fn is_empty(&self) -> bool {
        self.contacts.is_empty()
    }

    /// Returns all contacts as Vec. Turns Option::None into "".to_string()
    pub(crate) fn all(&self) -> Vec<Contact> {
        self.contacts.values().cloned().collect()
    }

    /// Inserts a new contact into the ContactList
    pub(crate) fn insert(&mut self, contact: Contact) {
        println!("Inserting contact: {:?}", contact);
        self.contacts.insert(contact.id.clone(), contact);
    }

    /// Returns the contact with the given id
    pub(crate) fn get(&self, id: &str) -> Option<&Contact> {
        self.contacts.get(id)
    }

    /// Removes the contact with the given id
    pub(crate) fn remove(&mut self, id: &str) -> Option<Contact> {
        self.contacts.remove(id)
    }

    /// Uses wurbo_in to emit an invite full of contact data for the given Contact id
    pub(crate) fn emit_invite(&mut self, id: String) {
        // Serialize the contact data and call wurbo_in::emit
        if let Some(contact) = self.get(&id) {
            // use serde json to serialize the contact into a JSON string
            let invite = contact.clone().into();

            // Record history
            self.contacts
                .get_mut(&id)
                .unwrap()
                .history
                .push(format!("Invite sent: {:?}", invite));

            // Emit the invite
            wurbo_in::emit(&invite);
        }
    }
}

/// Given a string of text, Pre-process input to standardize the phone number
pub fn process_phone_number(input: &String) -> String {
    let mut number = input.clone();
    number.retain(|c| c.is_digit(10));
    number
}

#[cfg(test)]
mod tests {
    // use super::*;
}
