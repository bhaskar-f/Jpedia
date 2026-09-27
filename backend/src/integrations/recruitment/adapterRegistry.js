const adapters=new Map();
function registerAdapter(sourceType,adapter){if(!adapter||typeof adapter.fetch!=='function'||typeof adapter.parse!=='function'||typeof adapter.normalize!=='function')throw new TypeError('Recruitment adapters must implement fetch, parse, and normalize.');adapters.set(sourceType,adapter);}
function getAdapter(sourceType){return adapters.get(sourceType)||null;}
module.exports={registerAdapter,getAdapter};
