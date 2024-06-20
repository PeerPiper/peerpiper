# PeerPiper Handler

A WebAssembly WIT Component which handles events on the network in accordance with built-in and composed modules.

When it comes to disk, only the logic is in the module. The data should stay outside, as WIT cannot handle async yet.

# Example Use Cases

- I need to save/sync data from my browser to my home node. I acquire (borrow, build or buy) a WIT component that will read Request messages, see if it meets my saving criteria (for example, does it have a valid UCAN?), then use the system import interface to authorize the data to be saved using my resources.

- Save data which matches a certain PubSub or ReqRes pattern to disk.
- Reply to certain PubSub or ReqRes messages with a custom message using chosen logic.
