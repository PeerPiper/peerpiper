use super::*;

#[component]
pub fn Input<'a>(name: &'a str, id: &'a str) {
    // Type of event listener to listen for
    let ty = "keyup";

    // Add this CSS selector to the list of selectors that will add event listeners
    super::wurbo_tracker::track(format!("#{id}"), ty);

    rsx! {
        <div>
            <div class={"italic font-semibold"}>
                {"The data you enter can't be seen by anyone else, since it's in a WebAssembly sandbox. =)"}
            </div>
            <input id
            value={name}
            class={"rounded border border-blue-400 bg-blue-100 text-neutral-700 p-2 m-2 placeholder:Enter"}
            placeholder={"Search for anything..."}
            />
            <div class={"italic font-semibold"}>
               {"But it can still calculate how many vowels are in your words for you!"}
            </div>
        </div>
    }
}
