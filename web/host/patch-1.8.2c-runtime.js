// 1.8.2c runtime hardening + 1.8.5/1.8.6 exact-resolution lifecycle.
(function(){
  const originalStart=window.start;
  const originalStop=window.stop;

  function disposeCaptureStream(reason='capture-dispose'){
    try{
      const old=stream;
      if(old){
        api.log?.('INFO','Capture stream disposing',{reason,trackCount:old.getTracks?.().length||0});
        old.getTracks?.().forEach(t=>{try{t.stop()}catch{}});
      }
    }catch(e){api.log?.('WARN','Capture stream dispose failed',e?.message||String(e))}
    try{$('v').srcObject=null}catch{}
    stream=null;
  }

  const applyConfiguredConstraints=async(track)=>{
    if(!track?.applyConstraints||track.__lanExactOutput)return;
    const c=cfg();
    const [w,h]=String(c.resolution||'1280x720').split('x').map(Number);
    const fps=Math.max(15,Number(c.fps)||30);
    if(!Number.isFinite(w)||!Number.isFinite(h))return;
    try{
      await track.applyConstraints({width:{ideal:w,max:w},height:{ideal:h,max:h},frameRate:{ideal:fps,max:fps},resizeMode:'crop-and-scale'});
      const s=track.getSettings?.()||{};
      api.log?.('INFO','Capture constraints applied',{requestedResolution:`${w}x${h}`,requestedFps:fps,actualResolution:`${s.width||'?'}x${s.height||'?'}`,actualFps:s.frameRate||null,resizeMode:s.resizeMode||null});
    }catch(e){
      api.log?.('WARN','Capture constraints could not be fully applied',{requestedResolution:`${w}x${h}`,requestedFps:fps,error:e?.message||String(e)});
      try{await track.applyConstraints({frameRate:{ideal:fps,max:fps}})}catch{}
    }
  };

  window.captureSelected=async function(){
    const id=$('s').value;if(!id)throw new Error('Источник не выбран');
    await api.selectSource(id);
    const c=cfg();
    const [w,h]=String(c.resolution||'1280x720').split('x').map(Number);
    const fps=Math.max(15,Number(c.fps)||30);
    const requestedResolution=`${w}x${h}`;
    api.log?.('INFO','RESOLUTION_REQUESTED',{requestedResolution,requestedFps:fps,sourceId:id});
    const s=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:w,max:w},height:{ideal:h,max:h},frameRate:{ideal:fps,max:fps},resizeMode:'crop-and-scale'},audio:c.audio});
    const t=s.getVideoTracks()[0];
    if(t){
      t.contentHint='detail';
      const before=t.getSettings?.()||{};
      api.log?.('INFO','CAPTURE_CREATED',{requestedResolution,requestedFps:fps,captureResolution:`${before.width||'?'}x${before.height||'?'}`,captureFps:before.frameRate||null});
      await applyConfiguredConstraints(t);
      const after=t.getSettings?.()||{};
      api.log?.('INFO','CAPTURE_SETTINGS',{requestedResolution,captureResolution:`${after.width||'?'}x${after.height||'?'}`,captureFps:after.frameRate||null,exact:after.width===w&&after.height===h});
    }
    const resultTracks=s.getVideoTracks?.()||[];
    const output=resultTracks[0];
    if(output){
      const os=output.getSettings?.()||{};
      api.log?.('INFO','OUTPUT_TRACK_READY',{requestedResolution,outputResolution:`${os.width||'?'}x${os.height||'?'}`,outputFps:os.frameRate||null,exact:os.width===w&&os.height===h,exactCanvas:!!output.__lanExactOutput});
    }
    return s;
  };

  window.start=async function(){
    stopping=false;
    const target=String(cfg().resolution||'1280x720');
    const current=stream?.getVideoTracks?.()[0]?.getSettings?.()||{};
    const currentResolution=(current.width&&current.height)?`${current.width}x${current.height}`:null;
    if(stream&&currentResolution&&currentResolution!==target){
      api.log?.('INFO','Stale capture detected before start',{requestedResolution:target,currentResolution});
      disposeCaptureStream('resolution-mismatch-before-start');
    }
    return originalStart();
  };

  window.stop=async function(){
    if(stopping)return;
    try{await originalStop()}finally{
      // app.js stops the server but intentionally keeps the renderer stream.
      // Always dispose it here so the next Start captures the newly selected resolution.
      disposeCaptureStream('stop');
      stopping=false;
    }
  };

  $('start').onclick=()=>window.start();
  $('stop').onclick=()=>window.stop();

  async function applyResolutionChange(){
    const requested=String(cfg().resolution||'1280x720');
    try{
      api.log?.('INFO','Resolution change requested',{requestedResolution:requested,running:!!$('state')?.dataset?.running});
      await api.saveConfig(cfg());
      const running=!!$('state')?.dataset?.running;
      if(running){
        // Stop the server and, critically, dispose the old capture before Start.
        // Otherwise app.js sees a non-null `stream` and silently reuses the old track.
        await window.stop();
        api.log?.('INFO','Resolution change restarting with fresh capture',{requestedResolution:requested,streamRecreated:true});
        await window.start();
      }else{
        disposeCaptureStream('resolution-change-while-stopped');
        updateStats();
      }
    }catch(e){
      api.log?.('ERROR','RESOLUTION_PIPELINE_FAILED',{requestedResolution:requested,error:e?.stack||e?.message||String(e)});
    }
  }

  const resolution=$('r');
  if(resolution)resolution.addEventListener('change',applyResolutionChange);

  const fps=$('f');
  if(fps)fps.addEventListener('change',async()=>{
    try{
      await api.saveConfig(cfg());
      const t=stream?.getVideoTracks?.()[0];
      if(t)await applyConfiguredConstraints(t);
      updateStats();
    }catch(e){api.log?.('WARN','FPS change failed',e?.message||String(e))}
  });
})();
