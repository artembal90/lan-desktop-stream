// 1.8.6: normalize legacy log records and add main-process runtime telemetry.
const fs=require('fs');
const original=fs.appendFileSync.bind(fs);
const {app}=require('electron');
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
function appendTelemetry(message,data){
  try{
    const p=app.getPath('userData')+'/lan-desktop-stream.log';
    const d=new Date();const pad=n=>String(n).padStart(2,'0');const ts=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,'0')}`;
    original(p,`[${ts}] [STAT ] [RUNTIME ] ${message}\n${JSON.stringify(data,null,2)}\n`,{encoding:'utf8'});
  }catch{}
}
let previousCpu=null,telemetryTimer=null;
app.whenReady().then(async()=>{
  try{const gpu=await app.getGPUInfo('basic');appendTelemetry('Main process GPU information',{gpu})}catch(e){appendTelemetry('Main process GPU information failed',{error:e?.message||String(e)})}
  const sample=()=>{
    const cpu=process.cpuUsage();
    const delta=previousCpu?{userMicros:cpu.user-previousCpu.user,systemMicros:cpu.system-previousCpu.system}:null;
    previousCpu=cpu;
    const mem=process.memoryUsage();
    appendTelemetry('Main process runtime health',{pid:process.pid,uptimeSec:Number(process.uptime().toFixed(1)),cpuUsageMicros:cpu,cpuDelta10sMicros:delta,memory:{rss:mem.rss,heapTotal:mem.heapTotal,heapUsed:mem.heapUsed,external:mem.external,arrayBuffers:mem.arrayBuffers},systemMemory:{total:require('os').totalmem(),free:require('os').freemem()},loadAverage:require('os').loadavg(),platform:process.platform,arch:process.arch,versions:{electron:process.versions.electron,chrome:process.versions.chrome,node:process.versions.node}});
  };
  sample();
  telemetryTimer=setInterval(sample,10000);
});
process.on('exit',()=>{if(telemetryTimer)clearInterval(telemetryTimer)});
require('./main.js');
