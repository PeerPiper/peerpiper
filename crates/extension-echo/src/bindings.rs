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
                    let result3 = T::handle_message(
                        _rt::string_lift(bytes0),
                        _rt::string_lift(bytes1),
                        _rt::Vec::from_raw_parts(arg4.cast(), len2, len2),
                    );
                    let ptr4 = _RET_AREA.0.as_mut_ptr().cast::<u8>();
                    let vec5 = (result3.into_bytes()).into_boxed_slice();
                    let ptr5 = vec5.as_ptr().cast::<u8>();
                    let len5 = vec5.len();
                    ::core::mem::forget(vec5);
                    *ptr4.add(4).cast::<usize>() = len5;
                    *ptr4.add(0).cast::<*mut u8>() = ptr5.cast_mut();
                    ptr4
                }
                #[doc(hidden)]
                #[allow(non_snake_case)]
                pub unsafe fn __post_return_handle_message<T: Guest>(arg0: *mut u8) {
                    let l0 = *arg0.add(0).cast::<*mut u8>();
                    let l1 = *arg0.add(4).cast::<usize>();
                    _rt::cabi_dealloc(l0, l1, 1);
                }
                pub trait Guest {
                    fn handle_message(
                        topic: _rt::String,
                        peer: _rt::String,
                        data: _rt::Vec<u8>,
                    ) -> _rt::String;
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
                        (arg0) } };
                    };
                }
                #[doc(hidden)]
                pub(crate) use __export_component_extension_handlers_0_1_0_cabi;
                #[repr(align(4))]
                struct _RetArea([::core::mem::MaybeUninit<u8>; 8]);
                static mut _RET_AREA: _RetArea = _RetArea(
                    [::core::mem::MaybeUninit::uninit(); 8],
                );
            }
        }
    }
}
mod _rt {
    #[cfg(target_arch = "wasm32")]
    pub fn run_ctors_once() {
        wit_bindgen_rt::run_ctors_once();
    }
    pub use alloc_crate::vec::Vec;
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
    pub use alloc_crate::string::String;
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
pub static __WIT_BINDGEN_COMPONENT_TYPE: [u8; 274] = *b"\
\0asm\x0d\0\x01\0\0\x19\x16wit-component-encoding\x04\0\x07\x8c\x01\x01A\x02\x01\
A\x02\x01B\x03\x01p}\x01@\x03\x05topics\x04peers\x04data\0\0s\x04\0\x0ehandle-me\
ssage\x01\x01\x04\x01\"component:extension/handlers@0.1.0\x05\0\x04\x01)componen\
t:extension/extension-world@0.1.0\x04\0\x0b\x15\x01\0\x0fextension-world\x03\0\0\
\0G\x09producers\x01\x0cprocessed-by\x02\x0dwit-component\x070.215.0\x10wit-bind\
gen-rust\x060.30.0";
#[inline(never)]
#[doc(hidden)]
pub fn __link_custom_section_describing_imports() {
    wit_bindgen_rt::maybe_link_cabi_realloc();
}
