use super::*;
use components::count::count_vowels;

#[component]
pub fn Output<'a>(name: &'a str, id: &'a str) {
    let count = count_vowels(name);

    rsx! {
        <div id class={"border-2 border-dashed border-green-500 p-4 rounded my-4"}>
        <b>{name}</b>
            {
                match count {
                    0 => { " has no vowels.".to_string() } ,
                    1 => {format!(" has {count} vowel.")}
                    _ => {format!(" has {count} vowels.")}
                }
            }
            <br/>
        </div>
    }
}
