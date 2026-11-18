const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync('tools/game-adapter.cjs','utf8');
const view=code.slice(code.indexOf('function view(install)'),code.indexOf('function action('));
let calls=0;
const context={document:{querySelector:q=>q==='#select.show #pick-view:not([hidden])'?{}:null}};
vm.createContext(context);vm.runInContext(view,context);
assert.equal(context.view(()=>calls++).online,false);assert.equal(calls,1);
console.log('Character selection starts the controller bridge while out of the world.');
