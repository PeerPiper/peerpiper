fn main() {
    // check to see if just is installed
    let mut cmd = std::process::Command::new("just");
    cmd.arg("--version");

    let status = cmd.status().unwrap();
    if !status.success() {
        panic!("just is not installed. Goto https://just.systems/");
    }

    // run command: just build-wallet

    let mut cmd = std::process::Command::new("just");
    cmd.arg("build-wallet");

    let status = cmd.status().unwrap();
    assert!(status.success());
}
