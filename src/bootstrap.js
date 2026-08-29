// 1.8.3: normalize the existing main-process log without changing stream logic.
// The legacy main.js writes one-line records through fs.appendFileSync().
// This wrapper formats those records into a readable structured log before main.js sees them.
const fs=require('fs');
const original=fs.appendFileSync.bind(fs);
const categoryFor=message=>{
  const m=String(message||'');
  if(/Application|Configuration/.test(m))return 'APP';
  if(/Source|Display capture|Screen source|Window source/.test(m))return 'SOURCE';
  if(/Server|Firewall/.test(m))return 'SERVER';
  if(/Receiver|receiver/i.test(m))return 'RECEIVER';
  if(/Statistics|Stats|Aggregate|TX|FPS|RTT|jitter|loss/i.test(m))return 'STAT';
  if(/Adaptive|congest|network|ICE|WebRTC/i.test(m))return 'NETWORK';
  if(/start|stop|Start|Stop/.test(m))return 'LIFECYCLE';
  return 'APP';
};
const prettyData=raw=>{
  const text=String(raw||'');
  const match=text.match(/^(\[[^\]]+\])\s+\[([^\]]+)\]\s+([^\n]*?)(?:\s+(\{[\s\S]*\}))?\n?$/);
  if(!match)return text;
  const [,ts,level,message,json]=match;
  let data='';
  if(json){try{data='\n'+JSON.stringify(JSON.parse(json),null,2)}catch{data='\n'+json}}
  return `${ts} [${level.padEnd(5)}] [${categoryFor(message).padEnd(8)}] ${message}${data}\n`;
};
fs.appendFileSync=function(file,data,options){
  if(typeof data==='string'&&String(file).endsWith('lan-desktop-stream.log'))data=prettyData(data);
  return original(file,data,options);
};
require('./main.js');
