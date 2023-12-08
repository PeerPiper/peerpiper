use super::*;

// This can be any layout we want
#[component]
pub fn Page<'a, Children: Render>(title: &'a str, children: Children) {
    let world = "planets";
    rsx! {
      <div class={"p-4"}>
        <h1 hello={world} class={"text-red-600 text-2xl font-bold"}>
            {title}
        </h1>
        <div>
            {children}
        </div>
      </div>
    }
}
