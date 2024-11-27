#[allow(dead_code)]
pub mod component {
    #[allow(dead_code)]
    pub mod contact_book {
        #[allow(dead_code, clippy::all)]
        pub mod wurbo_types {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            use super::super::super::_rt;
            /// Details required in order to add an event listener to an element
            #[derive(Clone)]
            pub struct ListenDetails {
                pub selector: _rt::String,
                pub ty: _rt::String,
            }
            impl ::core::fmt::Debug for ListenDetails {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("ListenDetails")
                        .field("selector", &self.selector)
                        .field("ty", &self.ty)
                        .finish()
                }
            }
            /// Content for a file, bytes and name
            #[derive(Clone)]
            pub struct FileDetails {
                /// The bytes of the file
                pub bytes: _rt::Vec<u8>,
                /// The name of the file
                pub filename: _rt::String,
            }
            impl ::core::fmt::Debug for FileDetails {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("FileDetails")
                        .field("bytes", &self.bytes)
                        .field("filename", &self.filename)
                        .finish()
                }
            }
        }
        #[allow(dead_code, clippy::all)]
        pub mod context_types {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            use super::super::super::_rt;
            pub type FileDetails = super::super::super::component::contact_book::wurbo_types::FileDetails;
            /// A contact
            #[derive(Clone)]
            pub struct Contact {
                pub id: Option<_rt::String>,
                pub first_name: _rt::String,
                pub last_name: _rt::String,
                pub email: _rt::String,
                pub phone: _rt::String,
            }
            impl ::core::fmt::Debug for Contact {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("Contact")
                        .field("id", &self.id)
                        .field("first-name", &self.first_name)
                        .field("last-name", &self.last_name)
                        .field("email", &self.email)
                        .field("phone", &self.phone)
                        .finish()
                }
            }
            /// The types of messages that can be emitted by the component
            #[derive(Clone)]
            pub enum Message {
                /// An invite for a contact
                Invite(Contact),
                /// Contact(s) that has been added
                Added(_rt::Vec<Contact>),
                /// Profile has been updated
                Profile(Contact),
            }
            impl ::core::fmt::Debug for Message {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    match self {
                        Message::Invite(e) => {
                            f.debug_tuple("Message::Invite").field(e).finish()
                        }
                        Message::Added(e) => {
                            f.debug_tuple("Message::Added").field(e).finish()
                        }
                        Message::Profile(e) => {
                            f.debug_tuple("Message::Profile").field(e).finish()
                        }
                    }
                }
            }
            #[derive(Clone)]
            pub struct Initial {
                pub load: Option<_rt::Vec<Contact>>,
            }
            impl ::core::fmt::Debug for Initial {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("Initial").field("load", &self.load).finish()
                }
            }
            #[derive(Clone)]
            pub enum Addctx {
                FirstName(_rt::String),
                LastName(_rt::String),
                Email(_rt::String),
                Phone(_rt::String),
                PublishingKey(_rt::Vec<u8>),
            }
            impl ::core::fmt::Debug for Addctx {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    match self {
                        Addctx::FirstName(e) => {
                            f.debug_tuple("Addctx::FirstName").field(e).finish()
                        }
                        Addctx::LastName(e) => {
                            f.debug_tuple("Addctx::LastName").field(e).finish()
                        }
                        Addctx::Email(e) => {
                            f.debug_tuple("Addctx::Email").field(e).finish()
                        }
                        Addctx::Phone(e) => {
                            f.debug_tuple("Addctx::Phone").field(e).finish()
                        }
                        Addctx::PublishingKey(e) => {
                            f.debug_tuple("Addctx::PublishingKey").field(e).finish()
                        }
                    }
                }
            }
            /// Updates the contact with the given id to the addctx value
            #[derive(Clone)]
            pub struct Update {
                pub id: _rt::String,
                pub vals: _rt::Vec<Addctx>,
            }
            impl ::core::fmt::Debug for Update {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("Update")
                        .field("id", &self.id)
                        .field("vals", &self.vals)
                        .finish()
                }
            }
            /// The type of context provided
            #[derive(Clone)]
            pub enum Context {
                AllContent(Initial),
                /// edits the contact details that is about to be created
                Buildcontact(Addctx),
                /// submits the new contact details
                Submitnewcontact,
                /// Uploaded contacts
                Upload(FileDetails),
                /// Emit the invite signal
                Invite(_rt::String),
                /// Updates the contact with the given id to the addctx value
                Updatecontact(Update),
                /// Saev My Profile
                Saveprofile,
            }
            impl ::core::fmt::Debug for Context {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    match self {
                        Context::AllContent(e) => {
                            f.debug_tuple("Context::AllContent").field(e).finish()
                        }
                        Context::Buildcontact(e) => {
                            f.debug_tuple("Context::Buildcontact").field(e).finish()
                        }
                        Context::Submitnewcontact => {
                            f.debug_tuple("Context::Submitnewcontact").finish()
                        }
                        Context::Upload(e) => {
                            f.debug_tuple("Context::Upload").field(e).finish()
                        }
                        Context::Invite(e) => {
                            f.debug_tuple("Context::Invite").field(e).finish()
                        }
                        Context::Updatecontact(e) => {
                            f.debug_tuple("Context::Updatecontact").field(e).finish()
                        }
                        Context::Saveprofile => {
                            f.debug_tuple("Context::Saveprofile").finish()
                        }
                    }
                }
            }
        }
        #[allow(dead_code, clippy::all)]
        pub mod wurbo_in {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            use super::super::super::_rt;
            pub type ListenDetails = super::super::super::component::contact_book::wurbo_types::ListenDetails;
            pub type Message = super::super::super::component::contact_book::context_types::Message;
            #[allow(unused_unsafe, clippy::all)]
            /// Add an event listener to the given element
            pub fn addeventlistener(details: &ListenDetails) {
                unsafe {
                    let super::super::super::component::contact_book::wurbo_types::ListenDetails {
                        selector: selector0,
                        ty: ty0,
                    } = details;
                    let vec1 = selector0;
                    let ptr1 = vec1.as_ptr().cast::<u8>();
                    let len1 = vec1.len();
                    let vec2 = ty0;
                    let ptr2 = vec2.as_ptr().cast::<u8>();
                    let len2 = vec2.len();
                    #[cfg(target_arch = "wasm32")]
                    #[link(wasm_import_module = "component:contact-book/wurbo-in@0.1.0")]
                    extern "C" {
                        #[link_name = "addeventlistener"]
                        fn wit_import(_: *mut u8, _: usize, _: *mut u8, _: usize);
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    fn wit_import(_: *mut u8, _: usize, _: *mut u8, _: usize) {
                        unreachable!()
                    }
                    wit_import(ptr1.cast_mut(), len1, ptr2.cast_mut(), len2);
                }
            }
            #[allow(unused_unsafe, clippy::all)]
            /// Emit an event message to the parent component
            pub fn emit(message: &Message) {
                unsafe {
                    let mut cleanup_list = _rt::Vec::new();
                    use super::super::super::component::contact_book::context_types::Message as V21;
                    let (
                        result22_0,
                        result22_1,
                        result22_2,
                        result22_3,
                        result22_4,
                        result22_5,
                        result22_6,
                        result22_7,
                        result22_8,
                        result22_9,
                        result22_10,
                        result22_11,
                    ) = match message {
                        V21::Invite(e) => {
                            let super::super::super::component::contact_book::context_types::Contact {
                                id: id0,
                                first_name: first_name0,
                                last_name: last_name0,
                                email: email0,
                                phone: phone0,
                            } = e;
                            let (result2_0, result2_1, result2_2) = match id0 {
                                Some(e) => {
                                    let vec1 = e;
                                    let ptr1 = vec1.as_ptr().cast::<u8>();
                                    let len1 = vec1.len();
                                    (1i32, ptr1.cast_mut(), len1)
                                }
                                None => (0i32, ::core::ptr::null_mut(), 0usize),
                            };
                            let vec3 = first_name0;
                            let ptr3 = vec3.as_ptr().cast::<u8>();
                            let len3 = vec3.len();
                            let vec4 = last_name0;
                            let ptr4 = vec4.as_ptr().cast::<u8>();
                            let len4 = vec4.len();
                            let vec5 = email0;
                            let ptr5 = vec5.as_ptr().cast::<u8>();
                            let len5 = vec5.len();
                            let vec6 = phone0;
                            let ptr6 = vec6.as_ptr().cast::<u8>();
                            let len6 = vec6.len();
                            (
                                0i32,
                                result2_0 as *mut u8,
                                result2_1,
                                result2_2,
                                ptr3.cast_mut(),
                                len3,
                                ptr4.cast_mut(),
                                len4,
                                ptr5.cast_mut(),
                                len5,
                                ptr6.cast_mut(),
                                len6,
                            )
                        }
                        V21::Added(e) => {
                            let vec13 = e;
                            let len13 = vec13.len();
                            let layout13 = _rt::alloc::Layout::from_size_align_unchecked(
                                vec13.len() * 44,
                                4,
                            );
                            let result13 = if layout13.size() != 0 {
                                let ptr = _rt::alloc::alloc(layout13).cast::<u8>();
                                if ptr.is_null() {
                                    _rt::alloc::handle_alloc_error(layout13);
                                }
                                ptr
                            } else {
                                ::core::ptr::null_mut()
                            };
                            for (i, e) in vec13.into_iter().enumerate() {
                                let base = result13.add(i * 44);
                                {
                                    let super::super::super::component::contact_book::context_types::Contact {
                                        id: id7,
                                        first_name: first_name7,
                                        last_name: last_name7,
                                        email: email7,
                                        phone: phone7,
                                    } = e;
                                    match id7 {
                                        Some(e) => {
                                            *base.add(0).cast::<u8>() = (1i32) as u8;
                                            let vec8 = e;
                                            let ptr8 = vec8.as_ptr().cast::<u8>();
                                            let len8 = vec8.len();
                                            *base.add(8).cast::<usize>() = len8;
                                            *base.add(4).cast::<*mut u8>() = ptr8.cast_mut();
                                        }
                                        None => {
                                            *base.add(0).cast::<u8>() = (0i32) as u8;
                                        }
                                    };
                                    let vec9 = first_name7;
                                    let ptr9 = vec9.as_ptr().cast::<u8>();
                                    let len9 = vec9.len();
                                    *base.add(16).cast::<usize>() = len9;
                                    *base.add(12).cast::<*mut u8>() = ptr9.cast_mut();
                                    let vec10 = last_name7;
                                    let ptr10 = vec10.as_ptr().cast::<u8>();
                                    let len10 = vec10.len();
                                    *base.add(24).cast::<usize>() = len10;
                                    *base.add(20).cast::<*mut u8>() = ptr10.cast_mut();
                                    let vec11 = email7;
                                    let ptr11 = vec11.as_ptr().cast::<u8>();
                                    let len11 = vec11.len();
                                    *base.add(32).cast::<usize>() = len11;
                                    *base.add(28).cast::<*mut u8>() = ptr11.cast_mut();
                                    let vec12 = phone7;
                                    let ptr12 = vec12.as_ptr().cast::<u8>();
                                    let len12 = vec12.len();
                                    *base.add(40).cast::<usize>() = len12;
                                    *base.add(36).cast::<*mut u8>() = ptr12.cast_mut();
                                }
                            }
                            cleanup_list.extend_from_slice(&[(result13, layout13)]);
                            (
                                1i32,
                                result13,
                                len13 as *mut u8,
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                        V21::Profile(e) => {
                            let super::super::super::component::contact_book::context_types::Contact {
                                id: id14,
                                first_name: first_name14,
                                last_name: last_name14,
                                email: email14,
                                phone: phone14,
                            } = e;
                            let (result16_0, result16_1, result16_2) = match id14 {
                                Some(e) => {
                                    let vec15 = e;
                                    let ptr15 = vec15.as_ptr().cast::<u8>();
                                    let len15 = vec15.len();
                                    (1i32, ptr15.cast_mut(), len15)
                                }
                                None => (0i32, ::core::ptr::null_mut(), 0usize),
                            };
                            let vec17 = first_name14;
                            let ptr17 = vec17.as_ptr().cast::<u8>();
                            let len17 = vec17.len();
                            let vec18 = last_name14;
                            let ptr18 = vec18.as_ptr().cast::<u8>();
                            let len18 = vec18.len();
                            let vec19 = email14;
                            let ptr19 = vec19.as_ptr().cast::<u8>();
                            let len19 = vec19.len();
                            let vec20 = phone14;
                            let ptr20 = vec20.as_ptr().cast::<u8>();
                            let len20 = vec20.len();
                            (
                                2i32,
                                result16_0 as *mut u8,
                                result16_1,
                                result16_2,
                                ptr17.cast_mut(),
                                len17,
                                ptr18.cast_mut(),
                                len18,
                                ptr19.cast_mut(),
                                len19,
                                ptr20.cast_mut(),
                                len20,
                            )
                        }
                    };
                    #[cfg(target_arch = "wasm32")]
                    #[link(wasm_import_module = "component:contact-book/wurbo-in@0.1.0")]
                    extern "C" {
                        #[link_name = "emit"]
                        fn wit_import(
                            _: i32,
                            _: *mut u8,
                            _: *mut u8,
                            _: usize,
                            _: *mut u8,
                            _: usize,
                            _: *mut u8,
                            _: usize,
                            _: *mut u8,
                            _: usize,
                            _: *mut u8,
                            _: usize,
                        );
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    fn wit_import(
                        _: i32,
                        _: *mut u8,
                        _: *mut u8,
                        _: usize,
                        _: *mut u8,
                        _: usize,
                        _: *mut u8,
                        _: usize,
                        _: *mut u8,
                        _: usize,
                        _: *mut u8,
                        _: usize,
                    ) {
                        unreachable!()
                    }
                    wit_import(
                        result22_0,
                        result22_1,
                        result22_2,
                        result22_3,
                        result22_4,
                        result22_5,
                        result22_6,
                        result22_7,
                        result22_8,
                        result22_9,
                        result22_10,
                        result22_11,
                    );
                    for (ptr, layout) in cleanup_list {
                        if layout.size() != 0 {
                            _rt::alloc::dealloc(ptr.cast(), layout);
                        }
                    }
                }
            }
        }
    }
}
#[allow(dead_code)]
pub mod exports {
    #[allow(dead_code)]
    pub mod component {
        #[allow(dead_code)]
        pub mod contact_book {
            #[allow(dead_code, clippy::all)]
            pub mod wurbo_out {
                #[used]
                #[doc(hidden)]
                static __FORCE_SECTION_REF: fn() = super::super::super::super::__link_custom_section_describing_imports;
                use super::super::super::super::_rt;
                pub type Context = super::super::super::super::component::contact_book::context_types::Context;
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_render_cabi<T: Guest>(
                    arg0: i32,
                    arg1: *mut u8,
                    arg2: *mut u8,
                    arg3: *mut u8,
                    arg4: usize,
                ) -> *mut u8 {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    use super::super::super::super::component::contact_book::context_types::Context as V45;
                    let v45 = match arg0 {
                        0 => {
                            let e45 = super::super::super::super::component::contact_book::context_types::Initial {
                                load: match arg1 as i32 {
                                    0 => None,
                                    1 => {
                                        let e = {
                                            let base16 = arg2;
                                            let len16 = arg3 as usize;
                                            let mut result16 = _rt::Vec::with_capacity(len16);
                                            for i in 0..len16 {
                                                let base = base16.add(i * 44);
                                                let e16 = {
                                                    let l0 = i32::from(*base.add(0).cast::<u8>());
                                                    let l4 = *base.add(12).cast::<*mut u8>();
                                                    let l5 = *base.add(16).cast::<usize>();
                                                    let len6 = l5;
                                                    let bytes6 = _rt::Vec::from_raw_parts(
                                                        l4.cast(),
                                                        len6,
                                                        len6,
                                                    );
                                                    let l7 = *base.add(20).cast::<*mut u8>();
                                                    let l8 = *base.add(24).cast::<usize>();
                                                    let len9 = l8;
                                                    let bytes9 = _rt::Vec::from_raw_parts(
                                                        l7.cast(),
                                                        len9,
                                                        len9,
                                                    );
                                                    let l10 = *base.add(28).cast::<*mut u8>();
                                                    let l11 = *base.add(32).cast::<usize>();
                                                    let len12 = l11;
                                                    let bytes12 = _rt::Vec::from_raw_parts(
                                                        l10.cast(),
                                                        len12,
                                                        len12,
                                                    );
                                                    let l13 = *base.add(36).cast::<*mut u8>();
                                                    let l14 = *base.add(40).cast::<usize>();
                                                    let len15 = l14;
                                                    let bytes15 = _rt::Vec::from_raw_parts(
                                                        l13.cast(),
                                                        len15,
                                                        len15,
                                                    );
                                                    super::super::super::super::component::contact_book::context_types::Contact {
                                                        id: match l0 {
                                                            0 => None,
                                                            1 => {
                                                                let e = {
                                                                    let l1 = *base.add(4).cast::<*mut u8>();
                                                                    let l2 = *base.add(8).cast::<usize>();
                                                                    let len3 = l2;
                                                                    let bytes3 = _rt::Vec::from_raw_parts(
                                                                        l1.cast(),
                                                                        len3,
                                                                        len3,
                                                                    );
                                                                    _rt::string_lift(bytes3)
                                                                };
                                                                Some(e)
                                                            }
                                                            _ => _rt::invalid_enum_discriminant(),
                                                        },
                                                        first_name: _rt::string_lift(bytes6),
                                                        last_name: _rt::string_lift(bytes9),
                                                        email: _rt::string_lift(bytes12),
                                                        phone: _rt::string_lift(bytes15),
                                                    }
                                                };
                                                result16.push(e16);
                                            }
                                            _rt::cabi_dealloc(base16, len16 * 44, 4);
                                            result16
                                        };
                                        Some(e)
                                    }
                                    _ => _rt::invalid_enum_discriminant(),
                                },
                            };
                            V45::AllContent(e45)
                        }
                        1 => {
                            let e45 = {
                                use super::super::super::super::component::contact_book::context_types::Addctx as V22;
                                let v22 = match arg1 as i32 {
                                    0 => {
                                        let e22 = {
                                            let len17 = arg3 as usize;
                                            let bytes17 = _rt::Vec::from_raw_parts(
                                                arg2.cast(),
                                                len17,
                                                len17,
                                            );
                                            _rt::string_lift(bytes17)
                                        };
                                        V22::FirstName(e22)
                                    }
                                    1 => {
                                        let e22 = {
                                            let len18 = arg3 as usize;
                                            let bytes18 = _rt::Vec::from_raw_parts(
                                                arg2.cast(),
                                                len18,
                                                len18,
                                            );
                                            _rt::string_lift(bytes18)
                                        };
                                        V22::LastName(e22)
                                    }
                                    2 => {
                                        let e22 = {
                                            let len19 = arg3 as usize;
                                            let bytes19 = _rt::Vec::from_raw_parts(
                                                arg2.cast(),
                                                len19,
                                                len19,
                                            );
                                            _rt::string_lift(bytes19)
                                        };
                                        V22::Email(e22)
                                    }
                                    3 => {
                                        let e22 = {
                                            let len20 = arg3 as usize;
                                            let bytes20 = _rt::Vec::from_raw_parts(
                                                arg2.cast(),
                                                len20,
                                                len20,
                                            );
                                            _rt::string_lift(bytes20)
                                        };
                                        V22::Phone(e22)
                                    }
                                    n => {
                                        debug_assert_eq!(n, 4, "invalid enum discriminant");
                                        let e22 = {
                                            let len21 = arg3 as usize;
                                            _rt::Vec::from_raw_parts(arg2.cast(), len21, len21)
                                        };
                                        V22::PublishingKey(e22)
                                    }
                                };
                                v22
                            };
                            V45::Buildcontact(e45)
                        }
                        2 => V45::Submitnewcontact,
                        3 => {
                            let e45 = {
                                let len23 = arg2 as usize;
                                let len24 = arg4;
                                let bytes24 = _rt::Vec::from_raw_parts(
                                    arg3.cast(),
                                    len24,
                                    len24,
                                );
                                super::super::super::super::component::contact_book::wurbo_types::FileDetails {
                                    bytes: _rt::Vec::from_raw_parts(arg1.cast(), len23, len23),
                                    filename: _rt::string_lift(bytes24),
                                }
                            };
                            V45::Upload(e45)
                        }
                        4 => {
                            let e45 = {
                                let len25 = arg2 as usize;
                                let bytes25 = _rt::Vec::from_raw_parts(
                                    arg1.cast(),
                                    len25,
                                    len25,
                                );
                                _rt::string_lift(bytes25)
                            };
                            V45::Invite(e45)
                        }
                        5 => {
                            let e45 = {
                                let len26 = arg2 as usize;
                                let bytes26 = _rt::Vec::from_raw_parts(
                                    arg1.cast(),
                                    len26,
                                    len26,
                                );
                                let base44 = arg3;
                                let len44 = arg4;
                                let mut result44 = _rt::Vec::with_capacity(len44);
                                for i in 0..len44 {
                                    let base = base44.add(i * 12);
                                    let e44 = {
                                        let l27 = i32::from(*base.add(0).cast::<u8>());
                                        use super::super::super::super::component::contact_book::context_types::Addctx as V43;
                                        let v43 = match l27 {
                                            0 => {
                                                let e43 = {
                                                    let l28 = *base.add(4).cast::<*mut u8>();
                                                    let l29 = *base.add(8).cast::<usize>();
                                                    let len30 = l29;
                                                    let bytes30 = _rt::Vec::from_raw_parts(
                                                        l28.cast(),
                                                        len30,
                                                        len30,
                                                    );
                                                    _rt::string_lift(bytes30)
                                                };
                                                V43::FirstName(e43)
                                            }
                                            1 => {
                                                let e43 = {
                                                    let l31 = *base.add(4).cast::<*mut u8>();
                                                    let l32 = *base.add(8).cast::<usize>();
                                                    let len33 = l32;
                                                    let bytes33 = _rt::Vec::from_raw_parts(
                                                        l31.cast(),
                                                        len33,
                                                        len33,
                                                    );
                                                    _rt::string_lift(bytes33)
                                                };
                                                V43::LastName(e43)
                                            }
                                            2 => {
                                                let e43 = {
                                                    let l34 = *base.add(4).cast::<*mut u8>();
                                                    let l35 = *base.add(8).cast::<usize>();
                                                    let len36 = l35;
                                                    let bytes36 = _rt::Vec::from_raw_parts(
                                                        l34.cast(),
                                                        len36,
                                                        len36,
                                                    );
                                                    _rt::string_lift(bytes36)
                                                };
                                                V43::Email(e43)
                                            }
                                            3 => {
                                                let e43 = {
                                                    let l37 = *base.add(4).cast::<*mut u8>();
                                                    let l38 = *base.add(8).cast::<usize>();
                                                    let len39 = l38;
                                                    let bytes39 = _rt::Vec::from_raw_parts(
                                                        l37.cast(),
                                                        len39,
                                                        len39,
                                                    );
                                                    _rt::string_lift(bytes39)
                                                };
                                                V43::Phone(e43)
                                            }
                                            n => {
                                                debug_assert_eq!(n, 4, "invalid enum discriminant");
                                                let e43 = {
                                                    let l40 = *base.add(4).cast::<*mut u8>();
                                                    let l41 = *base.add(8).cast::<usize>();
                                                    let len42 = l41;
                                                    _rt::Vec::from_raw_parts(l40.cast(), len42, len42)
                                                };
                                                V43::PublishingKey(e43)
                                            }
                                        };
                                        v43
                                    };
                                    result44.push(e44);
                                }
                                _rt::cabi_dealloc(base44, len44 * 12, 4);
                                super::super::super::super::component::contact_book::context_types::Update {
                                    id: _rt::string_lift(bytes26),
                                    vals: result44,
                                }
                            };
                            V45::Updatecontact(e45)
                        }
                        n => {
                            debug_assert_eq!(n, 6, "invalid enum discriminant");
                            V45::Saveprofile
                        }
                    };
                    let result46 = T::render(v45);
                    let ptr47 = _RET_AREA.0.as_mut_ptr().cast::<u8>();
                    match result46 {
                        Ok(e) => {
                            *ptr47.add(0).cast::<u8>() = (0i32) as u8;
                            let vec48 = (e.into_bytes()).into_boxed_slice();
                            let ptr48 = vec48.as_ptr().cast::<u8>();
                            let len48 = vec48.len();
                            ::core::mem::forget(vec48);
                            *ptr47.add(8).cast::<usize>() = len48;
                            *ptr47.add(4).cast::<*mut u8>() = ptr48.cast_mut();
                        }
                        Err(e) => {
                            *ptr47.add(0).cast::<u8>() = (1i32) as u8;
                            let vec49 = (e.into_bytes()).into_boxed_slice();
                            let ptr49 = vec49.as_ptr().cast::<u8>();
                            let len49 = vec49.len();
                            ::core::mem::forget(vec49);
                            *ptr47.add(8).cast::<usize>() = len49;
                            *ptr47.add(4).cast::<*mut u8>() = ptr49.cast_mut();
                        }
                    };
                    ptr47
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn __post_return_render<T: Guest>(arg0: *mut u8) {
                    let l0 = i32::from(*arg0.add(0).cast::<u8>());
                    match l0 {
                        0 => {
                            let l1 = *arg0.add(4).cast::<*mut u8>();
                            let l2 = *arg0.add(8).cast::<usize>();
                            _rt::cabi_dealloc(l1, l2, 1);
                        }
                        _ => {
                            let l3 = *arg0.add(4).cast::<*mut u8>();
                            let l4 = *arg0.add(8).cast::<usize>();
                            _rt::cabi_dealloc(l3, l4, 1);
                        }
                    }
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_activate_cabi<T: Guest>(
                    arg0: i32,
                    arg1: *mut u8,
                    arg2: usize,
                ) {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    T::activate(
                        match arg0 {
                            0 => None,
                            1 => {
                                let e = {
                                    let base3 = arg1;
                                    let len3 = arg2;
                                    let mut result3 = _rt::Vec::with_capacity(len3);
                                    for i in 0..len3 {
                                        let base = base3.add(i * 8);
                                        let e3 = {
                                            let l0 = *base.add(0).cast::<*mut u8>();
                                            let l1 = *base.add(4).cast::<usize>();
                                            let len2 = l1;
                                            let bytes2 = _rt::Vec::from_raw_parts(
                                                l0.cast(),
                                                len2,
                                                len2,
                                            );
                                            _rt::string_lift(bytes2)
                                        };
                                        result3.push(e3);
                                    }
                                    _rt::cabi_dealloc(base3, len3 * 8, 4);
                                    result3
                                };
                                Some(e)
                            }
                            _ => _rt::invalid_enum_discriminant(),
                        },
                    );
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_deactivate_cabi<T: Guest>(
                    arg0: *mut u8,
                    arg1: usize,
                ) {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    let len0 = arg1;
                    let bytes0 = _rt::Vec::from_raw_parts(arg0.cast(), len0, len0);
                    T::deactivate(_rt::string_lift(bytes0));
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_customize_cabi<T: Guest>(
                    arg0: *mut u8,
                    arg1: usize,
                ) -> *mut u8 {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    let base6 = arg0;
                    let len6 = arg1;
                    let mut result6 = _rt::Vec::with_capacity(len6);
                    for i in 0..len6 {
                        let base = base6.add(i * 16);
                        let e6 = {
                            let l0 = *base.add(0).cast::<*mut u8>();
                            let l1 = *base.add(4).cast::<usize>();
                            let len2 = l1;
                            let bytes2 = _rt::Vec::from_raw_parts(l0.cast(), len2, len2);
                            let l3 = *base.add(8).cast::<*mut u8>();
                            let l4 = *base.add(12).cast::<usize>();
                            let len5 = l4;
                            let bytes5 = _rt::Vec::from_raw_parts(l3.cast(), len5, len5);
                            (_rt::string_lift(bytes2), _rt::string_lift(bytes5))
                        };
                        result6.push(e6);
                    }
                    _rt::cabi_dealloc(base6, len6 * 16, 4);
                    let result7 = T::customize(result6);
                    let ptr8 = _RET_AREA.0.as_mut_ptr().cast::<u8>();
                    match result7 {
                        Ok(_) => {
                            *ptr8.add(0).cast::<u8>() = (0i32) as u8;
                        }
                        Err(e) => {
                            *ptr8.add(0).cast::<u8>() = (1i32) as u8;
                            let vec9 = (e.into_bytes()).into_boxed_slice();
                            let ptr9 = vec9.as_ptr().cast::<u8>();
                            let len9 = vec9.len();
                            ::core::mem::forget(vec9);
                            *ptr8.add(8).cast::<usize>() = len9;
                            *ptr8.add(4).cast::<*mut u8>() = ptr9.cast_mut();
                        }
                    };
                    ptr8
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn __post_return_customize<T: Guest>(arg0: *mut u8) {
                    let l0 = i32::from(*arg0.add(0).cast::<u8>());
                    match l0 {
                        0 => {}
                        _ => {
                            let l1 = *arg0.add(4).cast::<*mut u8>();
                            let l2 = *arg0.add(8).cast::<usize>();
                            _rt::cabi_dealloc(l1, l2, 1);
                        }
                    }
                }
                pub trait Guest {
                    /// renders the initial Web component with the given data
                    /// and the target template to use as top level entry point
                    fn render(ctx: Context) -> Result<_rt::String, _rt::String>;
                    /// listen on all or given selectors
                    fn activate(selectors: Option<_rt::Vec<_rt::String>>);
                    /// Deactivates given selector
                    fn deactivate(selector: _rt::String);
                    /// Optionally customize the configuration of the templates used to render the component
                    fn customize(
                        templates: _rt::Vec<(_rt::String, _rt::String)>,
                    ) -> Result<(), _rt::String>;
                }
                #[doc(hidden)]
                macro_rules! __export_component_contact_book_wurbo_out_0_1_0_cabi {
                    ($ty:ident with_types_in $($path_to_types:tt)*) => {
                        const _ : () = { #[export_name =
                        "component:contact-book/wurbo-out@0.1.0#render"] unsafe extern
                        "C" fn export_render(arg0 : i32, arg1 : * mut u8, arg2 : * mut
                        u8, arg3 : * mut u8, arg4 : usize,) -> * mut u8 {
                        $($path_to_types)*:: _export_render_cabi::<$ty > (arg0, arg1,
                        arg2, arg3, arg4) } #[export_name =
                        "cabi_post_component:contact-book/wurbo-out@0.1.0#render"] unsafe
                        extern "C" fn _post_return_render(arg0 : * mut u8,) {
                        $($path_to_types)*:: __post_return_render::<$ty > (arg0) }
                        #[export_name =
                        "component:contact-book/wurbo-out@0.1.0#activate"] unsafe extern
                        "C" fn export_activate(arg0 : i32, arg1 : * mut u8, arg2 :
                        usize,) { $($path_to_types)*:: _export_activate_cabi::<$ty >
                        (arg0, arg1, arg2) } #[export_name =
                        "component:contact-book/wurbo-out@0.1.0#deactivate"] unsafe
                        extern "C" fn export_deactivate(arg0 : * mut u8, arg1 : usize,) {
                        $($path_to_types)*:: _export_deactivate_cabi::<$ty > (arg0, arg1)
                        } #[export_name =
                        "component:contact-book/wurbo-out@0.1.0#customize"] unsafe extern
                        "C" fn export_customize(arg0 : * mut u8, arg1 : usize,) -> * mut
                        u8 { $($path_to_types)*:: _export_customize_cabi::<$ty > (arg0,
                        arg1) } #[export_name =
                        "cabi_post_component:contact-book/wurbo-out@0.1.0#customize"]
                        unsafe extern "C" fn _post_return_customize(arg0 : * mut u8,) {
                        $($path_to_types)*:: __post_return_customize::<$ty > (arg0) } };
                    };
                }
                #[doc(hidden)]
                pub(crate) use __export_component_contact_book_wurbo_out_0_1_0_cabi;
                #[repr(align(4))]
                struct _RetArea([::core::mem::MaybeUninit<u8>; 12]);
                static mut _RET_AREA: _RetArea = _RetArea(
                    [::core::mem::MaybeUninit::uninit(); 12],
                );
            }
        }
    }
}
mod _rt {
    pub use alloc_crate::string::String;
    pub use alloc_crate::vec::Vec;
    pub use alloc_crate::alloc;
    #[cfg(target_arch = "wasm32")]
    pub fn run_ctors_once() {
        wit_bindgen_rt::run_ctors_once();
    }
    pub unsafe fn string_lift(bytes: Vec<u8>) -> String {
        if cfg!(debug_assertions) {
            String::from_utf8(bytes).unwrap()
        } else {
            String::from_utf8_unchecked(bytes)
        }
    }
    pub unsafe fn invalid_enum_discriminant<T>() -> T {
        if cfg!(debug_assertions) {
            panic!("invalid enum discriminant")
        } else {
            core::hint::unreachable_unchecked()
        }
    }
    pub unsafe fn cabi_dealloc(ptr: *mut u8, size: usize, align: usize) {
        if size == 0 {
            return;
        }
        let layout = alloc::Layout::from_size_align_unchecked(size, align);
        alloc::dealloc(ptr, layout);
    }
    extern crate alloc as alloc_crate;
}
/// Generates `#[no_mangle]` functions to export the specified type as the
/// root implementation of all generated traits.
///
/// For more information see the documentation of `wit_bindgen::generate!`.
///
/// ```rust
/// # macro_rules! export{ ($($t:tt)*) => (); }
/// # trait Guest {}
/// struct MyType;
///
/// impl Guest for MyType {
///     // ...
/// }
///
/// export!(MyType);
/// ```
#[allow(unused_macros)]
#[doc(hidden)]
macro_rules! __export_example_impl {
    ($ty:ident) => {
        self::export!($ty with_types_in self);
    };
    ($ty:ident with_types_in $($path_to_types_root:tt)*) => {
        $($path_to_types_root)*::
        exports::component::contact_book::wurbo_out::__export_component_contact_book_wurbo_out_0_1_0_cabi!($ty
        with_types_in $($path_to_types_root)*::
        exports::component::contact_book::wurbo_out);
    };
}
#[doc(inline)]
pub(crate) use __export_example_impl as export;
#[cfg(target_arch = "wasm32")]
#[link_section = "component-type:wit-bindgen:0.35.0:component:contact-book@0.1.0:example:encoded world"]
#[doc(hidden)]
pub static __WIT_BINDGEN_COMPONENT_TYPE: [u8; 1185] = *b"\
\0asm\x0d\0\x01\0\0\x19\x16wit-component-encoding\x04\0\x07\xa3\x08\x01A\x02\x01\
A\x0c\x01B\x05\x01r\x02\x08selectors\x02tys\x04\0\x0elisten-details\x03\0\0\x01p\
}\x01r\x02\x05bytes\x02\x08filenames\x04\0\x0cfile-details\x03\0\x03\x03\0(compo\
nent:contact-book/wurbo-types@0.1.0\x05\0\x02\x03\0\0\x0elisten-details\x02\x03\0\
\0\x0cfile-details\x01B\x15\x02\x03\x02\x01\x01\x04\0\x0elisten-details\x03\0\0\x02\
\x03\x02\x01\x02\x04\0\x0cfile-details\x03\0\x02\x01ks\x01r\x05\x02id\x04\x0afir\
st-names\x09last-names\x05emails\x05phones\x04\0\x07contact\x03\0\x05\x01p\x06\x01\
q\x03\x06invite\x01\x06\0\x05added\x01\x07\0\x07profile\x01\x06\0\x04\0\x07messa\
ge\x03\0\x08\x01k\x07\x01r\x01\x04load\x0a\x04\0\x07initial\x03\0\x0b\x01p}\x01q\
\x05\x0afirst-name\x01s\0\x09last-name\x01s\0\x05email\x01s\0\x05phone\x01s\0\x0e\
publishing-key\x01\x0d\0\x04\0\x06addctx\x03\0\x0e\x01p\x0f\x01r\x02\x02ids\x04v\
als\x10\x04\0\x06update\x03\0\x11\x01q\x07\x0ball-content\x01\x0c\0\x0cbuildcont\
act\x01\x0f\0\x10submitnewcontact\0\0\x06upload\x01\x03\0\x06invite\x01s\0\x0dup\
datecontact\x01\x12\0\x0bsaveprofile\0\0\x04\0\x07context\x03\0\x13\x03\0*compon\
ent:contact-book/context-types@0.1.0\x05\x03\x02\x03\0\x01\x07message\x01B\x0a\x02\
\x03\x02\x01\x01\x04\0\x0elisten-details\x03\0\0\x02\x03\x02\x01\x02\x04\0\x0cfi\
le-details\x03\0\x02\x02\x03\x02\x01\x04\x04\0\x07message\x03\0\x04\x01@\x01\x07\
details\x01\x01\0\x04\0\x10addeventlistener\x01\x06\x01@\x01\x07message\x05\x01\0\
\x04\0\x04emit\x01\x07\x03\0%component:contact-book/wurbo-in@0.1.0\x05\x05\x02\x03\
\0\x01\x07context\x01B\x10\x02\x03\x02\x01\x06\x04\0\x07context\x03\0\0\x01j\x01\
s\x01s\x01@\x01\x03ctx\x01\0\x02\x04\0\x06render\x01\x03\x01ps\x01k\x04\x01@\x01\
\x09selectors\x05\x01\0\x04\0\x08activate\x01\x06\x01@\x01\x08selectors\x01\0\x04\
\0\x0adeactivate\x01\x07\x01o\x02ss\x01p\x08\x01j\0\x01s\x01@\x01\x09templates\x09\
\0\x0a\x04\0\x09customize\x01\x0b\x04\0&component:contact-book/wurbo-out@0.1.0\x05\
\x07\x04\0$component:contact-book/example@0.1.0\x04\0\x0b\x0d\x01\0\x07example\x03\
\0\0\0G\x09producers\x01\x0cprocessed-by\x02\x0dwit-component\x070.220.0\x10wit-\
bindgen-rust\x060.35.0";
#[inline(never)]
#[doc(hidden)]
pub fn __link_custom_section_describing_imports() {
    wit_bindgen_rt::maybe_link_cabi_realloc();
}
