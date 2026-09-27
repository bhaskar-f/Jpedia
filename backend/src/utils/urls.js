function validHttpUrl(value){try{const parsed=new URL(value);return parsed.protocol==='https:'||parsed.protocol==='http:';}catch{return false;}}
function isYoutubeUrl(value){try{const host=new URL(value).hostname.toLowerCase();return host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com');}catch{return false;}}
module.exports={validHttpUrl,isYoutubeUrl};
