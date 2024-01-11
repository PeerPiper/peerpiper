// We need to pass the JavaScript host code into out wasm components, so the functions can be called
export function buildCodeString(namespace) {
	return `
      const bc = new BroadcastChannel('${namespace}');

      export function addeventlistener({ selector, ty }) {
        document.querySelector(selector).addEventListener(ty, (e) => {

          // detect if form event
          if(e.target.closest('form')) {
            e.preventDefault();
          }

          let val;
          if(e.target.dataset.contextValue && e.target.value) {
            val = {
              ctx: JSON.parse(e.target.dataset.contextValue),
              value: e.target.value
            }
          } else {
            val = e.target.dataset.contextValue || e.target.value;
          }
          
          let ctx = { tag: e.target.dataset.contextName || e.target.name, val };

          let el = e.target.closest('[data-slot]');
          if(el) {
            ctx = { tag: el.dataset.slot, val: ctx };
            el = el.closest('[data-slot]');
          }

          // console.log({ctx});
          let rendered = window.${namespace}.render(ctx); 
          bc.postMessage(rendered);
        });
      }

      // Enables the guest components to emit a broadcast message to all peers on the same domain origin browsing context
      // Allows our wasm components to communicate with each other!
      export function emit(message) {
        bc.postMessage(message);
      }
`;
}
