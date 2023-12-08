const VOWELS: &[char] = &['a', 'A', 'e', 'E', 'i', 'I', 'o', 'O', 'u', 'U'];

pub fn count_vowels(s: &str) -> usize {
    s.chars().filter(|c| VOWELS.contains(c)).count()
}
