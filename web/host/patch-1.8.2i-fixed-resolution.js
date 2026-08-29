// 1.8.2i: fixed output resolution pipeline.
// getDisplayMedia constraints describe capture preferences; they do not guarantee
// the exact encoded frame size. Normalize the captured video through a canvas so
// the stream exposed to preview/WebRTC always has the selected width x height.
(function(){
  const mediaDevices=navigator.mediaDevices;
  if(!mediaDevices?.getDisplayMedia)return;
  const nativeGetDisplayMedia=mediaDevices.getDisplayMedia.bind(mediaDevices);
  const activePipelines=new Set();

  function parseResolution(){
    const raw=String(document.getElementById('r')?.value||'1280x720');
    const [w,h]=raw.split('x').map(Number);
    return {w:Number.isFinite(w)&&w>0?Math.round(w):1280,h:Number.isFinite(h)&&h>0?Math.round(h):720};
  }

  function drawFrame(video,ctx,w,h){
    if(video.readyState<2)return;
    const sw=video.videoWidth||w, sh=video.videoHeight||h;
    if(!sw||!sh)return;
    const scale=Math.min(w/sw,h/sh);
    const dw=Math.max(1,Math.round(sw*scale));
    const dh=Math.max(1,Math.round(sh*scale));
    const dx=Math.floor((w-dw)/2), dy=Math.floor((h-dh)/2);
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(video,dx,dy,dw,dh);
  }

  mediaDevices.getDisplayMedia=async function(constraints){
    const source=await nativeGetDisplayMedia(constraints);
    const track=source.getVideoTracks?.()[0];
    if(!track)return source;

    const {w,h}=parseResolution();
    const fps=Math.max(15,Number(document.getElementById('f')?.value)||30);
    const video=document.createElement('video');
    video.muted=true;
    video.playsInline=true;
    video.srcObject=new MediaStream([track]);
    await video.play().catch(()=>{});
    if(video.readyState<2){
      await new Promise(resolve=>{
        const done=()=>{video.removeEventListener('loadedmetadata',done);resolve()};
        video.addEventListener('loadedmetadata',done,{once:true});
        setTimeout(done,1500);
      });
    }

    const canvas=document.createElement('canvas');
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
    if(!ctx){video.srcObject=null;return source}

    const outputVideo=canvas.captureStream(fps);
    for(const at of source.getAudioTracks?.()||[])outputVideo.addTrack(at);
    const outputTrack=outputVideo.getVideoTracks()[0];
    const pipeline={source,outputVideo,video,canvas,ctx,raf:0,closed:false,w,h,fps};
    activePipelines.add(pipeline);

    let last=0;
    const frame=ts=>{
      if(pipeline.closed)return;
      if(!last||ts-last>=1000/fps-1){drawFrame(video,ctx,w,h);last=ts}
      pipeline.raf=requestAnimationFrame(frame);
    };
    pipeline.raf=requestAnimationFrame(frame);

    const cleanup=()=>{
      if(pipeline.closed)return;
      pipeline.closed=true;
      if(pipeline.raf)cancelAnimationFrame(pipeline.raf);
      try{video.pause()}catch{}
      video.srcObject=null;
      try{source.getTracks().forEach(t=>t.stop())}catch{}
      activePipelines.delete(pipeline);
    };
    outputTrack?.addEventListener('ended',cleanup,{once:true});
    track.addEventListener('ended',cleanup,{once:true});

    api.log?.('INFO','Fixed output capture enabled',{requestedResolution:`${w}x${h}`,requestedFps:fps,sourceResolution:`${video.videoWidth||'?'}x${video.videoHeight||'?'}`,outputResolution:`${w}x${h}`});
    return outputVideo;
  };

  window.addEventListener('beforeunload',()=>activePipelines.forEach(p=>{
    try{p.outputVideo.getTracks().forEach(t=>t.stop())}catch{}
  }));
})();
