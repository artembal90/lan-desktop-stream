const electron=require('electron');
const {desktopCapturer,ipcMain,app}=electron;
const fs=require('fs'),path=require('path');
const realGetSources=desktopCapturer.getSources.bind(desktopCapturer);
let cache=[];
let fullRefresh=null;
let firstScreenReady=false;
function sourceTypes(opts){return Array.isArray(opts?.types)?opts.types:[]}
async function fastGetSources(opts={}){
  const types=sourceTypes(opts);
  const wantsAll=types.includes('screen')&&types.includes('window');
  if(!wantsAll)return realGetSources(opts);
  if(cache.length){
    if(!fullRefresh)fullRefresh=realGetSources({types:['screen','window'],fetchWindowIcons:false}).then(s=>{cache=s}).catch(()=>{}).finally(()=>{fullRefresh=null});
    return cache;
  }
  if(!firstScreenReady){
    const screens=await realGetSources({types:['screen'],fetchWindowIcons:false});
    cache=screens;firstScreenReady=true;
    fullRefresh=realGetSources({types:['screen','window'],fetchWindowIcons:false}).then(s=>{cache=s}).catch(()=>{}).finally(()=>{fullRefresh=null});
    return screens;
  }
  return cache;
}
desktopCapturer.getSources=fastGetSources;
const originalHandle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,handler)=>{
  if(channel==='config-load'){
    return originalHandle(channel,async(...args)=>{
      const result=await handler(...args);
      try{
        const file=path.join(app.getPath('userData'),'config.json');
        if(!fs.existsSync(file))return {...result,resolution:'1280x720',fps:30,bitrate:6000000};
      }catch{}
      return result;
    });
  }
  return originalHandle(channel,handle);
};
require('./main-original');
