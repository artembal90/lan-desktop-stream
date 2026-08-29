// 1.8.2c runtime hardening + 1.8.5 exact-resolution protection.
(function(){
  const originalStart=window.start;
  const originalStop=window.stop;
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
    const c=cfg();const [w,h]=String(c.resolution||'1280x720').split('x').map(Number);const fps=Math.max(15,Number(c.fps)||30);
    const s=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:w,max:w},height:{ideal:h,max:h},frameRate:{ideal:fps,max:fps},resizeMode:'crop-and-scale'},audio:c.audio});
    const t=s.getVideoTracks()[0];if(t){t.contentHint='detail';await applyConfiguredConstraints(t)}return s;
  };
  window.start=async function(){stopping=false;return originalStart()};
  window.stop=async function(){if(stopping)return;await originalStop();stopping=false};
  $('start').onclick=()=>window.start();$('stop').onclick=()=>window.stop();
  const resolution=$('r');
  if(resolution)resolution.addEventListener('change',async()=>{try{await api.saveConfig(cfg());const t=stream?.getVideoTracks?.()[0];if(t)await applyConfiguredConstraints(t);updateStats()}catch(e){api.log?.('WARN','Resolution change failed',e?.message||String(e))}});
  const fps=$('f');
  if(fps)fps.addEventListener('change',async()=>{try{await api.saveConfig(cfg());const t=stream?.getVideoTracks?.()[0];if(t)await applyConfiguredConstraints(t);updateStats()}catch(e){api.log?.('WARN','FPS change failed',e?.message||String(e))}});
})();
