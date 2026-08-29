// 1.8.2i + 1.8.4 + 1.8.5 exact output resolution.
// Use native WebRTC only when the captured track already has the exact
// requested dimensions. Otherwise create an exact-size canvas track.
(function(){
  const mediaDevices=navigator.mediaDevices;
  if(!mediaDevices?.getDisplayMedia)return;
  const nativeGetDisplayMedia=mediaDevices.getDisplayMedia.bind(mediaDevices);

  function parseResolution(){
    const raw=String(document.getElementById('r')?.value||'1280x720');
    const [w,h]=raw.split('x').map(Number);
    return {w:Number.isFinite(w)&&w>0?Math.round(w):1280,h:Number.isFinite(h)&&h>0?Math.round(h):720};
  }

  mediaDevices.getDisplayMedia=async function(constraints){
    const source=await nativeGetDisplayMedia(constraints);
    const track=source.getVideoTracks?.()[0];
    if(!track)return source;
    const {w,h}=parseResolution();
    const fps=Math.max(15,Number(document.getElementById('f')?.value)||30);
    track.contentHint='detail';

    try{await track.applyConstraints({width:{ideal:w,max:w},height:{ideal:h,max:h},frameRate:{ideal:fps,max:fps}})}catch{}
    const settings=track.getSettings?.()||{};
    const sw=Number(settings.width||0),sh=Number(settings.height||0);

    if(sw===w&&sh===h){
      try{track.__lanTargetResolution={w,h,fps}}catch{}
      api.log?.('INFO','Native exact-resolution capture enabled',{requestedResolution:`${w}x${h}`,requestedFps:fps,sourceResolution:`${sw}x${sh}`});
      return source;
    }

    // Exact-size fallback. The generated track is marked so later lifecycle
    // code does not apply source constraints to it and accidentally change
    // 1280x720 -> 1280x698 or 1920x1080 -> 1920x1040.
    const video=document.createElement('video');
    video.muted=true;video.playsInline=true;video.srcObject=new MediaStream([track]);
    await video.play().catch(()=>{});
    if(video.readyState<2){
      await new Promise(resolve=>{
        const done=()=>{video.removeEventListener('loadedmetadata',done);resolve()};
        video.addEventListener('loadedmetadata',done,{once:true});setTimeout(done,1500);
      });
    }
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
    if(!ctx){video.srcObject=null;return source}
    const outputVideo=canvas.captureStream(fps);
    for(const at of source.getAudioTracks?.()||[])outputVideo.addTrack(at);
    const outputTrack=outputVideo.getVideoTracks()[0];
    try{outputTrack.__lanExactOutput=true;outputTrack.__lanTargetResolution={w,h,fps}}catch{}
    const pipeline={source,outputVideo,video,canvas,ctx,raf:0,closed:false};
    let last=0;
    const frame=ts=>{
      if(pipeline.closed)return;
      if(!last||ts-last>=1000/fps-1){
        if(video.readyState>=2){
          const vw=video.videoWidth||w,vh=video.videoHeight||h;
          const scale=Math.min(w/vw,h/vh),dw=Math.max(1,Math.round(vw*scale)),dh=Math.max(1,Math.round(vh*scale));
          ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.drawImage(video,Math.floor((w-dw)/2),Math.floor((h-dh)/2),dw,dh);
        }
        last=ts;
      }
      pipeline.raf=requestAnimationFrame(frame);
    };
    pipeline.raf=requestAnimationFrame(frame);
    const cleanup=()=>{
      if(pipeline.closed)return;pipeline.closed=true;
      if(pipeline.raf)cancelAnimationFrame(pipeline.raf);
      try{video.pause()}catch{}video.srcObject=null;
      try{source.getTracks().forEach(t=>t.stop())}catch{}
    };
    outputTrack?.addEventListener('ended',cleanup,{once:true});
    track.addEventListener('ended',cleanup,{once:true});
    api.log?.('INFO','Fixed output resolution fallback enabled',{requestedResolution:`${w}x${h}`,requestedFps:fps,sourceResolution:`${video.videoWidth||'?'}x${video.videoHeight||'?'}`,outputResolution:`${w}x${h}`});
    return outputVideo;
  };

  const proto=window.RTCPeerConnection?.prototype;
  if(proto?.addTrack){
    const nativeAddTrack=proto.addTrack;
    proto.addTrack=function(track,...streams){
      const sender=nativeAddTrack.call(this,track,...streams);
      if(track?.kind==='video'&&track.__lanTargetResolution&&!track.__lanExactOutput){
        const {w,h}=track.__lanTargetResolution,s=track.getSettings?.()||{};
        const sw=Number(s.width||0),sh=Number(s.height||0);
        if(sw===w&&sh===h){
          try{
            const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];
            p.encodings[0].scaleResolutionDownBy=1;sender.setParameters(p).catch(()=>{});
          }catch{}
        }
      }
      return sender;
    };
  }
})();
