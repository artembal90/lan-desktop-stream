// 1.8.2i + 1.8.4 CPU optimization.
// Prefer native WebRTC scaling for the common same-aspect downscale path.
// Canvas normalization remains the correctness fallback for non-matching
// aspect ratios and upscaling.
(function(){
  const mediaDevices=navigator.mediaDevices;
  if(!mediaDevices?.getDisplayMedia)return;
  const nativeGetDisplayMedia=mediaDevices.getDisplayMedia.bind(mediaDevices);

  function parseResolution(){
    const raw=String(document.getElementById('r')?.value||'1280x720');
    const [w,h]=raw.split('x').map(Number);
    return {w:Number.isFinite(w)&&w>0?Math.round(w):1280,h:Number.isFinite(h)&&h>0?Math.round(h):720};
  }

  function nativeScalingPossible(track,w,h){
    const s=track.getSettings?.()||{};
    const sw=Number(s.width||0),sh=Number(s.height||0);
    if(!sw||!sh||sw<w||sh<h)return false;
    return Math.abs((sw/sh)-(w/h))<0.01;
  }

  mediaDevices.getDisplayMedia=async function(constraints){
    const source=await nativeGetDisplayMedia(constraints);
    const track=source.getVideoTracks?.()[0];
    if(!track)return source;
    const {w,h}=parseResolution();
    const fps=Math.max(15,Number(document.getElementById('f')?.value)||30);
    track.contentHint='detail';

    // Low-CPU path: let Chromium/WebRTC perform the scale in the encoder.
    if(nativeScalingPossible(track,w,h)){
      try{track.__lanTargetResolution={w,h,fps}}catch{}
      api.log?.('INFO','Native output scaling enabled',{requestedResolution:`${w}x${h}`,requestedFps:fps,sourceResolution:`${track.getSettings?.().width||'?'}x${track.getSettings?.().height||'?'}`});
      return source;
    }

    // Exact-resolution fallback for unusual aspect ratios or upscaling.
    const video=document.createElement('video');
    video.muted=true;video.playsInline=true;
    video.srcObject=new MediaStream([track]);
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
    const pipeline={source,outputVideo,video,canvas,ctx,raf:0,closed:false};
    let last=0;
    const frame=ts=>{
      if(pipeline.closed)return;
      if(!last||ts-last>=1000/fps-1){
        if(video.readyState>=2){
          const sw=video.videoWidth||w,sh=video.videoHeight||h;
          const scale=Math.min(w/sw,h/sh),dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
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
      try{video.pause()}catch{} video.srcObject=null;
      try{source.getTracks().forEach(t=>t.stop())}catch{}
    };
    outputTrack?.addEventListener('ended',cleanup,{once:true});track.addEventListener('ended',cleanup,{once:true});
    api.log?.('INFO','Fixed output capture fallback enabled',{requestedResolution:`${w}x${h}`,requestedFps:fps,sourceResolution:`${video.videoWidth||'?'}x${video.videoHeight||'?'}`,outputResolution:`${w}x${h}`});
    return outputVideo;
  };

  // Encoder-side downscale is applied per receiver without per-frame canvas copies.
  const proto=window.RTCPeerConnection?.prototype;
  if(proto?.addTrack){
    const nativeAddTrack=proto.addTrack;
    proto.addTrack=function(track,...streams){
      const sender=nativeAddTrack.call(this,track,...streams);
      if(track?.kind==='video'&&track.__lanTargetResolution){
        const {w,h}=track.__lanTargetResolution,s=track.getSettings?.()||{};
        const sw=Number(s.width||0),sh=Number(s.height||0);
        if(sw>=w&&sh>=h){
          const scale=Math.max(1,Math.min(sw/w,sh/h));
          try{
            const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];
            p.encodings[0].scaleResolutionDownBy=scale;sender.setParameters(p).catch(()=>{});
          }catch{}
        }
      }
      return sender;
    };
  }
})();
