import { GestureTracker } from "../hand-tracking.js";

const video = document.getElementById("filter-video");
const canvas = document.getElementById("filter-canvas");
const ctx = canvas.getContext("2d");
const source = document.createElement("canvas");
const sourceCtx = source.getContext("2d");
const startBtn = document.getElementById("camera-start");
const nameEl = document.getElementById("filter-name");
const indexEl = document.getElementById("filter-index");
const gestureEl = document.getElementById("gesture-status");
const errorEl = document.getElementById("filter-error");
const filters = [
  { name: "LENS DISTORTION", type: "lens" },
  { name: "FOCUS BLOOM", type: "bloom" },
  { name: "COMPRESSION GLITCH", type: "glitch" },
  { name: "SWIRL FOLD", type: "swirl" },
];
let W = 1; let H = 1; let tracker; let last = performance.now(); let active = false; let filterIndex = 0; let cameraStarting = false; let retries = 0;
let pointer = { x: 0.5, y: 0.5 }; let previousGesture = "neutral"; let pinchArmedUntil = 0; let fistArmedUntil = 0;

function resize() { W = innerWidth; H = innerHeight; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; ctx.setTransform(dpr,0,0,dpr,0,0); source.width = W; source.height = H; }
function drawSource() { if (video.readyState < 2) { sourceCtx.fillStyle="#050609"; sourceCtx.fillRect(0,0,W,H); return; } const ratio=Math.max(W/video.videoWidth,H/video.videoHeight); const dw=video.videoWidth*ratio,dh=video.videoHeight*ratio; sourceCtx.save(); sourceCtx.clearRect(0,0,W,H); sourceCtx.translate(W,0); sourceCtx.scale(-1,1); sourceCtx.drawImage(video,(W-dw)/2,(H-dh)/2,dw,dh); sourceCtx.restore(); }
function setFilter(next, enabled=true) { filterIndex=(next+filters.length)%filters.length; active=enabled; indexEl.textContent=active?`FILTER 0${filterIndex+1}`:"FILTER 00"; nameEl.textContent=active?filters[filterIndex].name:"CAMERA READY"; }
function nextFilter() { setFilter(active?filterIndex+1:filterIndex,true); }
function renderFilter(now) {
  drawSource(); ctx.clearRect(0,0,W,H); ctx.drawImage(source,0,0,W,H); if (!active) return;
  const {type}=filters[filterIndex]; const x=pointer.x*W,y=pointer.y*H;
  if(type==="lens"){const r=Math.min(W,H)*.18;ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();ctx.filter="saturate(1.35) contrast(1.08)";ctx.translate(x,y);ctx.scale(1.32,1.32);ctx.drawImage(source,-x,-y,W,H);ctx.restore();ctx.strokeStyle="rgba(190,255,247,.72)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r+Math.sin(now*.004)*5,0,Math.PI*2);ctx.stroke();}
  if(type==="bloom"){ctx.save();ctx.globalAlpha=.32;ctx.filter="blur(18px) brightness(1.55) saturate(1.7)";ctx.drawImage(source,-10,-10,W+20,H+20);ctx.restore();const g=ctx.createRadialGradient(x,y,0,x,y,Math.min(W,H)*.38);g.addColorStop(0,"rgba(255,244,254,.35)");g.addColorStop(.45,"rgba(255,110,210,.13)");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  if(type==="glitch"){for(let i=0;i<18;i++){const sy=(i/18*H+now*.04) % H;const sh=4+(i%4)*5;ctx.save();ctx.beginPath();ctx.rect(0,sy,W,sh);ctx.clip();ctx.globalAlpha=.65;ctx.drawImage(source,Math.sin(now*.008+i)*22,0,W,H);ctx.fillStyle=i%2?"rgba(0,255,230,.13)":"rgba(255,30,140,.13)";ctx.fillRect(0,sy,W,sh);ctx.restore();}}
  if(type==="swirl"){const max=Math.min(W,H)*.42;for(let r=max;r>24;r-=24){ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();ctx.translate(x,y);ctx.rotate(Math.sin(now*.0015+r*.02)*.045*(1-r/max));ctx.translate(-x,-y);ctx.drawImage(source,0,0,W,H);ctx.restore();}}
}
function handleGesture(code,hands,now){if(hands.length)pointer={x:hands.reduce((s,h)=>s+h.x,0)/hands.length,y:hands.reduce((s,h)=>s+h.y,0)/hands.length};if(code==="1P")pinchArmedUntil=now+2600;if(code==="2F")fistArmedUntil=now+2600;if(code==="1O"&&pinchArmedUntil>now){setFilter(filterIndex,!active);pinchArmedUntil=0;}if(code==="2O"&&fistArmedUntil>now){nextFilter();fistArmedUntil=0;}if(code!==previousGesture){gestureEl.textContent=code==="neutral"?"1P → 1O 켜기 · 2F → 2O 다음 필터":`${code} 감지`;previousGesture=code;}}
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.033);last=now;if(tracker){try{const result=tracker.update(now,dt);if(result)handleGesture(result.gesture,result.hands,now);}catch(error){errorEl.textContent=error.message||String(error);}}renderFilter(now);}
async function start(){if(cameraStarting||tracker)return;cameraStarting=true;startBtn.hidden=true;startBtn.disabled=true;errorEl.textContent="";try{tracker=new GestureTracker(video);await tracker.start();cameraStarting=false;}catch(error){cameraStarting=false;tracker?.stop();tracker=null;errorEl.textContent=`카메라를 시작할 수 없습니다. ${error.message||error}`;startBtn.disabled=false;if(error.name!=="NotAllowedError"&&retries<1){retries+=1;setTimeout(start,1800);}else{startBtn.hidden=false;startBtn.textContent="RETRY CAMERA";}}}
canvas.addEventListener("pointermove",(event)=>{pointer={x:event.clientX/W,y:event.clientY/H};});canvas.addEventListener("click",()=>{if(!active)setFilter(filterIndex,true);else nextFilter();});addEventListener("wheel",(event)=>{setFilter(filterIndex+(event.deltaY>0?1:-1),true);},{passive:true});addEventListener("resize",resize);startBtn.addEventListener("click",start);resize();requestAnimationFrame(loop);start();
