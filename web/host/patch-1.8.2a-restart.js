// 1.8.2a: restart-safe lifecycle hardening.
// Serialize Start/Stop so a new Start can never race an unfinished Stop.
(function(){
  const originalStart=window.start;
  const originalStop=window.stop;
  let lifecycle=Promise.resolve();
  let startRequested=false;

  async function runStart(){
    startRequested=true;
    lifecycle=lifecycle.then(async()=>{
      if(!startRequested)return;
      startRequested=false;
      stopping=false;
      api.log?.('INFO','1.8.2a Start requested',{stopping:false});
      try{
        await originalStart();
      }catch(e){
        api.log?.('ERROR','1.8.2a Start failed',e?.stack||e?.message||String(e));
        throw e;
      }
    });
    return lifecycle;
  }

  async function runStop(){
    startRequested=false;
    lifecycle=lifecycle.then(async()=>{
      if(stopping)return;
      api.log?.('INFO','1.8.2a Stop requested');
      try{
        await originalStop();
      }catch(e){
        api.log?.('ERROR','1.8.2a Stop failed',e?.stack||e?.message||String(e));
      }finally{
        stopping=false;
        api.log?.('INFO','1.8.2a Stop completed',{stopping:false});
      }
    });
    return lifecycle;
  }

  window.start=runStart;
  window.stop=runStop;
  $('start').onclick=()=>runStart();
  $('stop').onclick=()=>runStop();
})();
