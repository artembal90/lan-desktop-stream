const fs=require('fs');
const path=require('path');

function createLogger(getPath){
  const pad=(n,w=2)=>String(n).padStart(w,'0');
  const timestamp=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}`};
  const formatValue=v=>{
    if(v===undefined)return '';
    if(typeof v==='string')return v;
    try{return JSON.stringify(v,null,2)}catch{return String(v)}
  };
  const write=(level,category,message,data)=>{
    try{
      const extra=data===undefined?'':`\n${formatValue(data)}`;
      const line=`[${timestamp()}] [${String(level).toUpperCase().padEnd(5)}] [${String(category||'APP').toUpperCase().padEnd(8)}] ${message}${extra}\n`;
      const p=getPath();fs.mkdirSync(path.dirname(p),{recursive:true});fs.appendFileSync(p,line,{encoding:'utf8'});
    }catch{}
    const text=`[${category||'APP'}] ${message}`;
    if(level==='ERROR')console.error(text,data);else if(level==='WARN')console.warn(text,data);else console.log(text,data||'');
  };
  return {info:(category,message,data)=>write('INFO',category,message,data),warn:(category,message,data)=>write('WARN',category,message,data),error:(category,message,data)=>write('ERROR',category,message,data),stat:(category,message,data)=>write('STAT',category,message,data),debug:(category,message,data)=>write('DEBUG',category,message,data)};
}
module.exports={createLogger};
