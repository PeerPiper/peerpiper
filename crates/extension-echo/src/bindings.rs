#[allow(dead_code)]
pub mod component {
    #[allow(dead_code)]
    pub mod extension {
        #[allow(dead_code, clippy::all)]
        pub mod peer_piper_commands {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            #[allow(unused_unsafe, clippy::all)]
            /// Tells the DHT to start providing the given key (bytes)
            pub fn start_providing(key: &[u8]) {
                unsafe {
                    let vec0 = key;
                    let ptr0 = vec0.as_ptr().cast::<u8>();
                    let len0 = vec0.len();
                    #[cfg(target_arch = "wasm32")]
                    #[link(
                        wasm_import_module = "component:extension/peer-piper-commands@0.1.0"
                    )]
                    extern "C" {
                        #[link_name = "start-providing"]
                        fn wit_import(_: *mut u8, _: usize);
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    fn wit_import(_: *mut u8, _: usize) {
                        unreachable!()
                    }
                    wit_import(ptr0.cast_mut(), len0);
                }
            }
        }
        #[allow(dead_code, clippy::all)]
        pub mod logging {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            #[allow(unused_unsafe, clippy::all)]
            /// Log a message
            pub fn log(message: &str) {
                unsafe {
                    let vec0 = message;
                    let ptr0 = vec0.as_ptr().cast::<u8>();
                    let len0 = vec0.len();
                    #[cfg(target_arch = "wasm32")]
                    #[link(wasm_import_module = "component:extension/logging@0.1.0")]
                    extern "C" {
                        #[link_name = "log"]
                        fn wit_import(_: *mut u8, _: usize);
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    fn wit_import(_: *mut u8, _: usize) {
                        unreachable!()
                    }
                    wit_import(ptr0.cast_mut(), len0);
                }
            }
        }
        #[allow(dead_code, clippy::all)]
        pub mod types {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            use super::super::super::_rt;
            #[derive(Clone)]
            pub struct Message {
                pub topic: _rt::String,
                pub peer: _rt::String,
                pub data: _rt::Vec<u8>,
            }
            impl ::core::fmt::Debug for Message {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("Message")
                        .field("topic", &self.topic)
                        .field("peer", &self.peer)
                        .field("data", &self.data)
                        .finish()
                }
            }
            #[derive(Clone)]
            pub enum Error {
                /// This plugin does not support the given message data type
                UnsupportedMessageType,
                /// An error that occurred handling a message
                HandlerError(_rt::String),
                /// An input output error
                IoError(_rt::String),
            }
            impl ::core::fmt::Debug for Error {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    match self {
                        Error::UnsupportedMessageType => {
                            f.debug_tuple("Error::UnsupportedMessageType").finish()
                        }
                        Error::HandlerError(e) => {
                            f.debug_tuple("Error::HandlerError").field(e).finish()
                        }
                        Error::IoError(e) => {
                            f.debug_tuple("Error::IoError").field(e).finish()
                        }
                    }
                }
            }
            impl ::core::fmt::Display for Error {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    write!(f, "{:?}", self)
                }
            }
            impl std::error::Error for Error {}
        }
    }
}
#[allow(dead_code)]
pub mod exports {
    #[allow(dead_code)]
    pub mod component {
        #[allow(dead_code)]
        pub mod extension {
            #[allow(dead_code, clippy::all)]
            pub mod handlers {
                #[used]
                #[doc(hidden)]
                static __FORCE_SECTION_REF: fn() = super::super::super::super::__link_custom_section_describing_imports;
                use super::super::super::super::_rt;
                pub type Message = super::super::super::super::component::extension::types::Message;
                pub type Error = super::super::super::super::component::extension::types::Error;
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_handle_message_cabi<T: Guest>(
                    arg0: *mut u8,
                    arg1: usize,
                    arg2: *mut u8,
                    arg3: usize,
                    arg4: *mut u8,
                    arg5: usize,
                ) -> *mut u8 {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    let len0 = arg1;
                    let bytes0 = _rt::Vec::from_raw_parts(arg0.cast(), len0, len0);
                    let len1 = arg3;
                    let bytes1 = _rt::Vec::from_raw_parts(arg2.cast(), len1, len1);
                    let len2 = arg5;
                    let result3 = T::handle_message(super::super::super::super::component::extension::types::Message {
                        topic: _rt::string_lift(bytes0),
                        peer: _rt::string_lift(bytes1),
                        data: _rt::Vec::from_raw_parts(arg4.cast(), len2, len2),
                    });
                    let ptr4 = _RET_AREA.0.as_mut_ptr().cast::<u8>();
                    match result3 {
                        Ok(e) => {
                            *ptr4.add(0).cast::<u8>() = (0i32) as u8;
                            let vec5 = (e.into_bytes()).into_boxed_slice();
                            let ptr5 = vec5.as_ptr().cast::<u8>();
                            let len5 = vec5.len();
                            ::core::mem::forget(vec5);
                            *ptr4.add(8).cast::<usize>() = len5;
                            *ptr4.add(4).cast::<*mut u8>() = ptr5.cast_mut();
                        }
                        Err(e) => {
                            *ptr4.add(0).cast::<u8>() = (1i32) as u8;
                            use super::super::super::super::component::extension::types::Error as V8;
                            match e {
                                V8::UnsupportedMessageType => {
                                    *ptr4.add(4).cast::<u8>() = (0i32) as u8;
                                }
                                V8::HandlerError(e) => {
                                    *ptr4.add(4).cast::<u8>() = (1i32) as u8;
                                    let vec6 = (e.into_bytes()).into_boxed_slice();
                                    let ptr6 = vec6.as_ptr().cast::<u8>();
                                    let len6 = vec6.len();
                                    ::core::mem::forget(vec6);
                                    *ptr4.add(12).cast::<usize>() = len6;
                                    *ptr4.add(8).cast::<*mut u8>() = ptr6.cast_mut();
                                }
                                V8::IoError(e) => {
                                    *ptr4.add(4).cast::<u8>() = (2i32) as u8;
                                    let vec7 = (e.into_bytes()).into_boxed_slice();
                                    let ptr7 = vec7.as_ptr().cast::<u8>();
                                    let len7 = vec7.len();
                                    ::core::mem::forget(vec7);
                                    *ptr4.add(12).cast::<usize>() = len7;
                                    *ptr4.add(8).cast::<*mut u8>() = ptr7.cast_mut();
                                }
                            }
                        }
                    };
                    ptr4
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn __post_return_handle_message<T: Guest>(arg0: *mut u8) {
                    let l0 = i32::from(*arg0.add(0).cast::<u8>());
                    match l0 {
                        0 => {
                            let l1 = *arg0.add(4).cast::<*mut u8>();
                            let l2 = *arg0.add(8).cast::<usize>();
                            _rt::cabi_dealloc(l1, l2, 1);
                        }
                        _ => {
                            let l3 = i32::from(*arg0.add(4).cast::<u8>());
                            match l3 {
                                0 => {}
                                1 => {
                                    let l4 = *arg0.add(8).cast::<*mut u8>();
                                    let l5 = *arg0.add(12).cast::<usize>();
                                    _rt::cabi_dealloc(l4, l5, 1);
                                }
                                _ => {
                                    let l6 = *arg0.add(8).cast::<*mut u8>();
                                    let l7 = *arg0.add(12).cast::<usize>();
                                    _rt::cabi_dealloc(l6, l7, 1);
                                }
                            }
                        }
                    }
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn _export_handle_request_cabi<T: Guest>(
                    arg0: *mut u8,
                    arg1: usize,
                ) -> *mut u8 {
                    #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
                    let len0 = arg1;
                    let result1 = T::handle_request(
                        _rt::Vec::from_raw_parts(arg0.cast(), len0, len0),
                    );
                    let ptr2 = _RET_AREA.0.as_mut_ptr().cast::<u8>();
                    match result1 {
                        Ok(e) => {
                            *ptr2.add(0).cast::<u8>() = (0i32) as u8;
                            let vec3 = (e).into_boxed_slice();
                            let ptr3 = vec3.as_ptr().cast::<u8>();
                            let len3 = vec3.len();
                            ::core::mem::forget(vec3);
                            *ptr2.add(8).cast::<usize>() = len3;
                            *ptr2.add(4).cast::<*mut u8>() = ptr3.cast_mut();
                        }
                        Err(e) => {
                            *ptr2.add(0).cast::<u8>() = (1i32) as u8;
                            use super::super::super::super::component::extension::types::Error as V6;
                            match e {
                                V6::UnsupportedMessageType => {
                                    *ptr2.add(4).cast::<u8>() = (0i32) as u8;
                                }
                                V6::HandlerError(e) => {
                                    *ptr2.add(4).cast::<u8>() = (1i32) as u8;
                                    let vec4 = (e.into_bytes()).into_boxed_slice();
                                    let ptr4 = vec4.as_ptr().cast::<u8>();
                                    let len4 = vec4.len();
                                    ::core::mem::forget(vec4);
                                    *ptr2.add(12).cast::<usize>() = len4;
                                    *ptr2.add(8).cast::<*mut u8>() = ptr4.cast_mut();
                                }
                                V6::IoError(e) => {
                                    *ptr2.add(4).cast::<u8>() = (2i32) as u8;
                                    let vec5 = (e.into_bytes()).into_boxed_slice();
                                    let ptr5 = vec5.as_ptr().cast::<u8>();
                                    let len5 = vec5.len();
                                    ::core::mem::forget(vec5);
                                    *ptr2.add(12).cast::<usize>() = len5;
                                    *ptr2.add(8).cast::<*mut u8>() = ptr5.cast_mut();
                                }
                            }
                        }
                    };
                    ptr2
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn __post_return_handle_request<T: Guest>(arg0: *mut u8) {
                    let l0 = i32::from(*arg0.add(0).cast::<u8>());
                    match l0 {
                        0 => {
                            let l1 = *arg0.add(4).cast::<*mut u8>();
                            let l2 = *arg0.add(8).cast::<usize>();
                            let base3 = l1;
                            let len3 = l2;
                            _rt::cabi_dealloc(base3, len3 * 1, 1);
                        }
                        _ => {
                            let l4 = i32::from(*arg0.add(4).cast::<u8>());
                            match l4 {
                                0 => {}
                                1 => {
                                    let l5 = *arg0.add(8).cast::<*mut u8>();
                                    let l6 = *arg0.add(12).cast::<usize>();
                                    _rt::cabi_dealloc(l5, l6, 1);
                                }
                                _ => {
                                    let l7 = *arg0.add(8).cast::<*mut u8>();
                                    let l8 = *arg0.add(12).cast::<usize>();
                                    _rt::cabi_dealloc(l7, l8, 1);
                                }
                            }
                        }
                    }
                }
                pub trait Guest {
                    /// Handle a message from the world. Returns a string response or error
                    fn handle_message(msg: Message) -> Result<_rt::String, Error>;
                    /// Handles inbound requests with the given bytes
                    /// Responds with a list of bytes or an error
                    fn handle_request(data: _rt::Vec<u8>) -> Result<_rt::Vec<u8>, Error>;
                }
                #[doc(hidden)]
                macro_rules! __export_component_extension_handlers_0_1_0_cabi {
                    ($ty:ident with_types_in $($path_to_types:tt)*) => {
                        const _ : () = { #[export_name =
                        "component:extension/handlers@0.1.0#handle-message"] unsafe
                        extern "C" fn export_handle_message(arg0 : * mut u8, arg1 :
                        usize, arg2 : * mut u8, arg3 : usize, arg4 : * mut u8, arg5 :
                        usize,) -> * mut u8 { $($path_to_types)*::
                        _export_handle_message_cabi::<$ty > (arg0, arg1, arg2, arg3,
                        arg4, arg5) } #[export_name =
                        "cabi_post_component:extension/handlers@0.1.0#handle-message"]
                        unsafe extern "C" fn _post_return_handle_message(arg0 : * mut
                        u8,) { $($path_to_types)*:: __post_return_handle_message::<$ty >
                        (arg0) } #[export_name =
                        "component:extension/handlers@0.1.0#handle-request"] unsafe
                        extern "C" fn export_handle_request(arg0 : * mut u8, arg1 :
                        usize,) -> * mut u8 { $($path_to_types)*::
                        _export_handle_request_cabi::<$ty > (arg0, arg1) } #[export_name
                        = "cabi_post_component:extension/handlers@0.1.0#handle-request"]
                        unsafe extern "C" fn _post_return_handle_request(arg0 : * mut
                        u8,) { $($path_to_types)*:: __post_return_handle_request::<$ty >
                        (arg0) } };
                    };
                }
                #[doc(hidden)]
                pub(crate) use __export_component_extension_handlers_0_1_0_cabi;
                #[repr(align(4))]
                struct _RetArea([::core::mem::MaybeUninit<u8>; 16]);
                static mut _RET_AREA: _RetArea = _RetArea(
                    [::core::mem::MaybeUninit::uninit(); 16],
                );
            }
        }
    }
}
mod _rt {
    pub use alloc_crate::string::String;
    pub use alloc_crate::vec::Vec;
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
    pub unsafe fn cabi_dealloc(ptr: *mut u8, size: usize, align: usize) {
        if size == 0 {
            return;
        }
        let layout = alloc::Layout::from_size_align_unchecked(size, align);
        alloc::dealloc(ptr, layout);
    }
    extern crate alloc as alloc_crate;
    pub use alloc_crate::alloc;
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
macro_rules! __export_extension_world_impl {
    ($ty:ident) => {
        self::export!($ty with_types_in self);
    };
    ($ty:ident with_types_in $($path_to_types_root:tt)*) => {
        $($path_to_types_root)*::
        exports::component::extension::handlers::__export_component_extension_handlers_0_1_0_cabi!($ty
        with_types_in $($path_to_types_root)*:: exports::component::extension::handlers);
    };
}
#[doc(inline)]
pub(crate) use __export_extension_world_impl as export;
#[cfg(target_arch = "wasm32")]
#[link_section = "component-type:wit-bindgen:0.30.0:extension-world:encoded world"]
#[doc(hidden)]
pub static __WIT_BINDGEN_COMPONENT_TYPE: [u8; 654] = *b"\
\0asm\x0d\0\x01\0\0\x19\x16wit-component-encoding\x04\0\x07\x88\x04\x01A\x02\x01\
A\x0a\x01B\x03\x01p}\x01@\x01\x03key\0\x01\0\x04\0\x0fstart-providing\x01\x01\x03\
\x01-component:extension/peer-piper-commands@0.1.0\x05\0\x01B\x02\x01@\x01\x07me\
ssages\x01\0\x04\0\x03log\x01\0\x03\x01!component:extension/logging@0.1.0\x05\x01\
\x01B\x05\x01p}\x01r\x03\x05topics\x04peers\x04data\0\x04\0\x07message\x03\0\x01\
\x01q\x03\x18unsupported-message-type\0\0\x0dhandler-error\x01s\0\x08io-error\x01\
s\0\x04\0\x05error\x03\0\x03\x03\x01\x1fcomponent:extension/types@0.1.0\x05\x02\x02\
\x03\0\x02\x07message\x02\x03\0\x02\x05error\x01B\x0b\x02\x03\x02\x01\x03\x04\0\x07\
message\x03\0\0\x02\x03\x02\x01\x04\x04\0\x05error\x03\0\x02\x01j\x01s\x01\x03\x01\
@\x01\x03msg\x01\0\x04\x04\0\x0ehandle-message\x01\x05\x01p}\x01j\x01\x06\x01\x03\
\x01@\x01\x04data\x06\0\x07\x04\0\x0ehandle-request\x01\x08\x04\x01\"component:e\
xtension/handlers@0.1.0\x05\x05\x04\x01)component:extension/extension-world@0.1.\
0\x04\0\x0b\x15\x01\0\x0fextension-world\x03\0\0\0G\x09producers\x01\x0cprocesse\
d-by\x02\x0dwit-component\x070.215.0\x10wit-bindgen-rust\x060.30.0";
#[inline(never)]
#[doc(hidden)]
pub fn __link_custom_section_describing_imports() {
    wit_bindgen_rt::maybe_link_cabi_realloc();
}
