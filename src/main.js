const {app,BrowserWindow,desktopCapturer,session,screen,ipcMain}=require('electron');
const path=require('path'),os=require('os'),fs=require('fs'),dgram=require('dgram'),express=require('express'),http=require('http'),WebSocket=require('ws'),QRCode=require('qrcode');
let win,server,wss,port=8080,selectedSourceId,hostWs=null,receivers=new Map(),currentConfig={pin:''};
const cfgPath=()=>path.join(app.getPath('userData'),'config.json');
function load(){try{return JSON.parse(fs.readFileSync(cfgPath(),'utf8'))}catch{return{port:8080,resolution:'1920x1080',fps:60,bitrate:20000000,audio:false,autoStart:false,pin:''}}}
function save(c){fs.mkdirSync(path.dirname(cfgPath()),{recursive:true});fs.writeFileSync(cfgPath(),JSON.stringify(c,null,2));currentConfig=c}
function isPrivate(ip){const p=ip.split('.').map(Number);return ip&&p.length===4&&((p[0]===10)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168))}
function interfaces(){const out=[];for(const [name,list] of Object.entries(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal&&isPrivate(n.address))out.push({name,address:n.address,netmask:n.netmask||''});return out}
function ip(){return new Promise(resolve=>{const s=dgram.createSocket('udp4');let done=false;const finish=x=>{if(done)return;done=true;try{s.close()}catch{}resolve(x)};s.once('error',()=>finish(interfaces()[0]?.address||'127.0.0.1'));try{s.connect(9,'192.0.2.1',()=>finish(s.address().address))}catch{finish(interfaces()[0]?.address||'127.0.0.1')}})}
function list(){return[...receivers.values()].map(x=>x.info)}
function event(x){win?.webContents.send('server-event',x)}
function send(ws,m){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m))}
async function startServer(p){
  const ex=express();ex.disable('x-powered-by');ex.use(express.static(path.join(__dirname,'..','web','receiver')));
  server=http.createServer(ex);wss=new WebSocket.Server({server,path:'/signal'});
  wss.on('connection',(ws,req)=>{const rip=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');let id=null,role='';
    ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return};
      if(m.type==='join'){role=m.role;if(role==='host'){if(hostWs&&hostWs!==ws)try{hostWs.close()}catch{};hostWs=ws;send(ws,{type:'host-ready'});for(const r of receivers.values())send(ws,{type:'receiver-joined',receiver:r.info});return}
        if(role==='receiver'){const wantedPin=String(m.pin||'');if(currentConfig.pin&&wantedPin!==String(currentConfig.pin)){send(ws,{type:'auth-error',message:'Неверный PIN'});setTimeout(()=>{try{ws.close()}catch{}},100);return}
          id=Date.now()+'-'+Math.random().toString(36).slice(2,10);const info={id,name:String(m.name||'Browser').slice(0,40),ip:rip};receivers.set(id,{ws,info});send(ws,{type:'joined',id});event({type:'receivers',receivers:list()});send(hostWs,{type:'receiver-joined',receiver:info});}return}
      if(role==='receiver'&&id)send(hostWs,{type:'receiver-signal',receiverId:id,payload:m});
      else if(role==='host'&&m.receiverId){const r=receivers.get(m.receiverId);send(r?.ws,m.payload)}
    });
    ws.on('close',()=>{if(ws===hostWs)hostWs=null;if(id){receivers.delete(id);event({type:'receivers',receivers:list()});send(hostWs,{type:'receiver-left',receiverId:id})}});
  });
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(p,'0.0.0.0',res)})
}
async function stop(){for(const r of receivers.values())try{r.ws.close()}catch{}receivers.clear();try{hostWs?.close()}catch{}hostWs=null;try{wss?.close()}catch{}if(server)await new Promise(r=>server.close(r));server=null;wss=null}
function create(){win=new BrowserWindow({width:1120,height:820,backgroundColor:'#0d1015',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});win.loadFile(path.join(__dirname,'..','web','host','index.html'))}
app.whenReady().then(()=>{currentConfig=load();session.defaultSession.setDisplayMediaRequestHandler(async(_r,cb)=>{const s=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});cb({video:s.find(x=>x.id===selectedSourceId)||s[0]})});
  ipcMain.handle('sources',async()=>{const s=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:240,height:135}});return s.map(x=>({id:x.id,name:x.name,display_id:x.display_id,thumbnail:x.thumbnail.toDataURL()}))});ipcMain.handle('config-load',load);ipcMain.handle('config-save',(_e,c)=>{save(c);return true});ipcMain.handle('select-source',(_e,id)=>{selectedSourceId=id;return true});ipcMain.handle('start-server',async(_e,c)=>{await stop();port=Number(c.port);save(c);await startServer(port);const hostIp=await ip();const u=`http://${hostIp}:${port}/`;return{url:u,ip:hostIp,port,qr:await QRCode.toDataURL(u)}});ipcMain.handle('stop-server',stop);ipcMain.handle('network-info',async()=>({ip:await ip(),interfaces:interfaces()}));create()});
app.on('window-all-closed',async()=>{await stop();if(process.platform!=='darwin')app.quit()});
