const fs=require('fs');
const path=require('path');

// TEST MODE: file writer disabled intentionally.
// This build is used to determine whether [[object Object]] is produced by
// the standalone logger.js writer or by the main.js logging path.
function createLogger(getPath){
  const pad=(n,w=2)=>String(n).padStart(w,'0');
  const timestamp=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}`};
  const formatValue=v=>{
    if(v===undefined)return '';
    if(v===null)return 'null';
    if(typeof v==='string')return v;
    const seen=new WeakSet();
    const normalize=x=>{
      if(x===undefined)return null;
      if(x===null||typeof x==='string'||typeof x==='number'||typeof x==='boolean')return x;
      if(typeof x==='bigint')return `${x}n`;
      if(x instanceof Error)return{name:x.name,message:x.message,stack:x.stack,code:x.code};
      if(typeof x==='object'){
        if(seen.has(x))return '[Circular]';
        seen.add(x);
        if(Array.isArray(x))return x.map(normalize);
        const out={};
        for(const [k,val] of Object.entries(x)){try{out[k]=normalize(val)}catch(e){out[k]=`[Unserializable: ${e?.message||'unknown'}]`}}
        return out;
      }
      return String(x);
    };
    try{return JSON.stringify(normalize(v),null,2)}catch(e){return JSON.stringify({serializationError:e?.message||'unknown',valueType:typeof v},null,2)}
  };
  const write=(level,category,message,data)=>{
    // INTENTIONAL TEST: logger.js does not write anything to disk.
    // fs.appendFileSync(...) is disabled for this diagnostic build.
    const text=`[${category||'APP'}] ${message}`;
    if(level==='ERROR')console.error(text,data);else if(level==='WARN')console.warn(text,data);else console.log(text,data||'');
  };
  return {info:(category,message,data)=>write('INFO',category,message,data),warn:(category,message,data)=>write('WARN',category,message,data),error:(category,message,data)=>write('ERROR',category,message,data),stat:(category,message,data)=>write('STAT',category,message,data),debug:(category,message,data)=>write('DEBUG',category,message,data)};
}
module.exports={createLogger};
