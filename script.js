const video = document.getElementById("video");
const stage = document.getElementById("stage");
const stickersDiv = document.getElementById("stickers");

let stream = null;
let facing = "user";

/* ---------------- KAMERA ---------------- */
async function startCamera(){
  if(stream) stream.getTracks().forEach(t=>t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video:{ facingMode:facing }
  });

  video.srcObject = stream;
  video.style.transform = facing==="user" ? "scaleX(-1)" : "none";
}

document.getElementById("flip").onclick = ()=>{
  facing = facing==="user" ? "environment" : "user";
  startCamera();
};

startCamera();

/* ---------------- NALepke ---------------- */
document.querySelectorAll(".emojis button").forEach(btn=>{
  btn.onclick = ()=>{
    const el = document.createElement("div");
    el.className="sticker";
    el.textContent = btn.textContent;
    el.style.left="50%";
    el.style.top="50%";

    let dragging=false;

    el.onpointerdown = e=>{
      dragging=true;
      el.setPointerCapture(e.pointerId);
    };
    el.onpointermove = e=>{
      if(!dragging) return;
      const r = stage.getBoundingClientRect();
      el.style.left = ((e.clientX-r.left)/r.width*100)+"%";
      el.style.top  = ((e.clientY-r.top)/r.height*100)+"%";
    };
    el.onpointerup = ()=> dragging=false;

    stickersDiv.appendChild(el);
  };
});

/* ---------------- FOTOGRAFIRANJE ---------------- */
document.getElementById("shot").onclick = async ()=>{
  const W=1080, H=1920;
  const canvas = document.createElement("canvas");
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext("2d");

  /* video crop */
  const vw=video.videoWidth, vh=video.videoHeight;
  const tr=W/H, vr=vw/vh;
  let sx=0,sy=0,sw=vw,sh=vh;
  if(vr>tr){ sw=vh*tr; sx=(vw-sw)/2; }
  else{ sh=vw/tr; sy=(vh-sh)/2; }

  if(facing==="user"){
    ctx.translate(W,0); ctx.scale(-1,1);
  }
  ctx.drawImage(video,sx,sy,sw,sh,0,0,W,H);
  ctx.setTransform(1,0,0,1,0,0);

  /* overlay */
  const overlay = document.querySelector(".overlay");
  const ow=overlay.naturalWidth, oh=overlay.naturalHeight;
  const sc=Math.min(W/ow,H/oh);
  ctx.drawImage(overlay,(W-ow*sc)/2,(H-oh*sc)/2,ow*sc,oh*sc);

  /* nalepke */
  document.querySelectorAll(".sticker").forEach(s=>{
    const r=stage.getBoundingClientRect();
    const x=parseFloat(s.style.left)/100*W;
    const y=parseFloat(s.style.top)/100*H;
    ctx.font="80px system-ui";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(s.textContent,x,y);
  });

  const url = canvas.toDataURL("image/png");

  /* ⬇️ SAMODEJNI PRENOS / iOS fallback */
  const a=document.createElement("a");
  a.href=url;
  a.download="fotofilter.png";
  a.target="_blank";
  a.click();
};
