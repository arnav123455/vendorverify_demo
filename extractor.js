/* VendorVerify document processing – free/open-source only: PDF.js text layer → Tesseract.js OCR → regex/label parsers.
   No network AI calls. Produces {value, confidence, page} per field and NEVER decides verification outcomes. */
(function(root,factory){const m=factory();if(typeof module!=="undefined"&&module.exports)module.exports=m;else root.DocExtract=m})(typeof self!=="undefined"?self:this,function(){
const MAXP=30,PANT={P:"Individual",C:"Company",F:"Firm / LLP",H:"HUF",A:"AOP",T:"Trust",B:"BOI",L:"Local Authority",J:"Artificial Juridical Person",G:"Government"};
const BANKS=[["State Bank of India","SBIN"],["HDFC Bank","HDFC"],["ICICI Bank","ICIC"],["Axis Bank","UTIB"],["Kotak Mahindra Bank","KKBK"],["Punjab National Bank","PUNB"],["Bank of Baroda","BARB"],["Canara Bank","CNRB"],["Union Bank of India","UBIN"],["IDFC FIRST Bank","IDFB"],["Yes Bank","YESB"],["IndusInd Bank","INDB"],["Bank of India","BKID"],["Central Bank of India","CBIN"],["Indian Bank","IDIB"],["Federal Bank","FDRL"],["UCO Bank","UCBA"],["IDBI Bank","IBKL"],["Indian Overseas Bank","IOBA"],["Bank of Maharashtra","MAHB"],["RBL Bank","RATN"],["Bandhan Bank","BDBL"]].sort((a,b)=>b[0].length-a[0].length);
const cl=s=>String(s||"").replace(/[|_~=]+/g," ").replace(/\s+/g," ").replace(/^[\s:;\-.,]+|[\s:;,|]+$/g,"").trim(),stop=s=>/^\d+\s*[.)]\s/.test(s)||/:\s*$/.test(s);
/* value after a label on the same line, else on the next line (never crossing into the next numbered field) */
function lab(L,re,ex){for(let i=0;i<L.length;i++){const l=L[i].t,m=l.match(re);if(!m||(ex&&ex.test(l)))continue;const r=cl(l.slice(m.index+m[0].length));if(r)return{v:r,p:L[i].p,c:L[i].c};for(let j=i+1;j<Math.min(L.length,i+3);j++){const n=cl(L[j].t);if(n&&!stop(n))return{v:n,p:L[j].p,c:L[j].c};if(n)break}}return null}
const pat=(L,re)=>{for(const x of L){const m=x.t.toUpperCase().match(re);if(m)return{v:m[0],p:x.p,c:x.c}}return null};
const tol=(L,after,re)=>{const i=L.findIndex(x=>after.test(x.t));if(i<0)return null;for(const x of L.slice(i,i+4)){const m=x.t.toUpperCase().match(re);if(m)return{v:m[0],p:x.p,c:x.c,abs:.3}}return null};
const none=v=>!v||/^(NA|N\/A|NIL|NONE|-+)$/i.test(v);
/* confidence = scan/text quality × pattern quality; format-invalid candidates are capped at 0.30 (engine treats <0.40 as unreadable) */
const F=(r,q=1)=>r&&r.v&&!none(r.v)?{value:r.v,confidence:r.abs??Math.min(.99,+(r.c/100*q).toFixed(2)),page:r.p}:{value:null,confidence:0,page:null};
const join=(L,a,b)=>{const x=a.filter(Boolean);return x.length?{v:x.map(o=>o.k?o.k+": "+o.v:o.v).join("; "),p:x[0].p,c:Math.min(...x.map(o=>o.c))}:null};
const P={
pan(L){let r=pat(L,/\b[A-Z]{5}\d{4}[A-Z]\b/)||tol(L,/PERMANENT\s*ACCOUNT/i,/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b/);
 const nm=lab(L,/^\W*(?:[^\n\/]{0,12}\/\s*)?Name\b[\s:\-]*/i,/father|mother|trade|legal|enterprise|account/i);
 const ty=r&&!r.abs&&PANT[r.v[3]]?{v:PANT[r.v[3]]+" (PAN 4th character “"+r.v[3]+"”)",p:r.p,c:r.c*.9}:null;return{pan:F(r),name:F(nm),type:F(ty)}},
gst(L){const g=pat(L,/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/)||tol(L,/Registration\s*Number|GSTIN/i,/\b[A-Z0-9]{15}\b/);
 const ai=L.findIndex(x=>/Address\s*of\s*Principal|Principal\s*Place/i.test(x.t));let ad=null;if(ai>=0){const o=[L[ai].t.replace(/^.*?(?:Business|Place)[^:\n]*[:\-]?/i,"")];let c=L[ai].c;for(let j=ai+1;j<Math.min(L.length,ai+7);j++){const t=L[j].t;if(stop(t)&&/^\d+\s*[.)]/.test(t)||/Date of Liability|Period of Validity|Type of Registration/i.test(t))break;o.push(t);c=Math.min(c,L[j].c)}const v=cl(o.map(cl).filter(Boolean).join(", "));if(v)ad={v,p:L[ai].p,c}}
 const T=L.map(x=>x.t).join("\n"),pv=T.match(/From\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:?\s*(\d{2}\/\d{2}\/\d{4}|NA|N\/A)/i),ty=lab(L,/Type\s*of\s*Registration[\s:\-]*/i),dl=lab(L,/Date\s*of\s*Liability[\s:\-]*/i),st=lab(L,/Status[\s:\-]*/i,/type/i);
 return{gstin:F(g),legal:F(lab(L,/Legal\s*Name[\s:\-]*/i)),trade:F(lab(L,/Trade\s*Name[^:\n]*:[\s]*/i)),status:F(st&&/^(Active|Cancelled|Suspended|Provisional)/i.test(st.v)?st:null),address:F(ad,.95),
 details:F(join(L,[ty&&{...ty,k:"Type"},dl&&{...dl,k:"Date of liability"},pv&&{v:pv[1]+" to "+pv[2],k:"Valid",p:1,c:L[0]?.c||0}]),.95)}},
bank(L){const ifs=pat(L,/\b[A-Z]{4}0[A-Z0-9]{6}\b/)||tol(L,/IFS\s*C?/i,/\b[A-Z]{4}[A-Z0-9]{7}\b/);let ac=null;const re=/(?:A\/?C(?:COUNT)?\.?\s*(?:NO|NUMBER|#)?|ACCOUNT\s*(?:NO|NUMBER|#))\.?\s*[:\-]?\s*([0-9][0-9 \-]{7,22}[0-9])/i;
 for(const x of L){const m=x.t.match(re);if(m){const d=m[1].replace(/\D/g,"");ac={v:d,p:x.p,c:x.c,...(d.length<9||d.length>18?{abs:.3}:{})};break}}
 let h=lab(L,/(?:Account\s*Holder(?:'?s)?(?:\s*Name)?|Name\s*of\s*(?:the\s*)?Account\s*Holder|Account\s*Name|Beneficiary(?:\s*Name)?|A\/?C\s*Holder|Customer\s*Name)[\s:\-]*/i),hq=1;
 if(!h){const x=L.find(x=>/^\W*(?:FOR|M\/S)\s+\S/i.test(x.t));if(x){h={v:cl(x.t.replace(/^\W*(?:FOR|M\/S)\s+/i,"")),p:x.p,c:x.c};hq=.7}}
 const T=L.map(x=>x.t).join("\n"),bn=BANKS.find(b=>new RegExp(b[0].replace(/ /g,"\\s+"),"i").test(T));let bk=null,bq=1;
 if(bn){const x=L.find(x=>new RegExp(bn[0].replace(/ /g,"\\s+"),"i").test(x.t));bk={v:bn[0],p:x.p,c:x.c}}else if(ifs&&!ifs.abs){const b=BANKS.find(b=>b[1]==ifs.v.slice(0,4));if(b){bk={v:b[0],p:ifs.p,c:ifs.c};bq=.75}}
 return{holder:F(h,hq),acct:F(ac),ifsc:F(ifs),bank:F(bk,bq)}},
udyam(L){const T=L.map(x=>x.t);let n=null;for(const x of L){const m=x.t.toUpperCase().match(/UDYAM[\s\-–—]*([A-Z]{2})[\s\-–—]*(\d{2})[\s\-–—]*(\d{7})/);if(m){n={v:`UDYAM-${m[1]}-${m[2]}-${m[3]}`,p:x.p,c:x.c};break}}
 if(!n)n=tol(L,/UDYAM|REGISTRATION\s*NUMBER/i,/\bUDYAM[A-Z0-9\- ]{8,20}/);
 const nm=lab(L,/Name\s*of\s*(?:the\s*)?(?:Unit|Enterprise)[\s:\-]*/i)||lab(L,/Enterprise\s*Name[\s:\-]*/i);let cat=null,cq=1;const m1=lab(L,/(?:Type\s*of\s*Enterprise|Enterprise\s*Type|Classification|Category)[^:\n]*?[:\-]?\s*/i);
 if(m1&&/(micro|small|medium)/i.test(m1.v))cat={v:m1.v.match(/micro|small|medium/i)[0].replace(/^./,c=>c.toUpperCase()).toLowerCase().replace(/^./,c=>c.toUpperCase()),p:m1.p,c:m1.c};
 else{const x=L.find(x=>/\b(MICRO|SMALL|MEDIUM)\b/i.test(x.t));if(x){cat={v:x.t.match(/micro|small|medium/i)[0].toLowerCase().replace(/^./,c=>c.toUpperCase()),p:x.p,c:x.c};cq=.7}}
 const dr=lab(L,/Date\s*of\s*Udyam\s*Registration[\s:\-]*/i),ma=lab(L,/Major\s*Activity[\s:\-]*/i),di=lab(L,/Date\s*of\s*(?:Incorporation|Commencement)[^:\n]*[\s:\-]*/i);
 return{no:F(n),name:F(nm),category:F(cat,cq),details:F(join(L,[dr&&{...dr,k:"Registered on"},ma&&{...ma,k:"Major activity"},di&&{...di,k:"Incorporation/commencement"}]),.95)}}};
const KW={pan:/INCOME\s*TAX|PERMANENT\s*ACCOUNT|\b[A-Z]{5}\d{4}[A-Z]\b/i,gst:/\bGST|GOODS\s*AND\s*SERVICES|REG-06/i,bank:/IFS\s*C|BANK|A\/?C\b|ACCOUNT/i,udyam:/UDYAM|MSME|ENTERPRISE/i};
function parse(type,pages){const L=[];pages.forEach(p=>p.text.split("\n").forEach(t=>{t=t.replace(/\s+/g," ").trim();if(t)L.push({t,p:p.n,c:p.conf})}));return{fields:P[type](L),matches:KW[type].test(L.map(x=>x.t).join("\n"))}}
function pdfLines(items){const rows=[];for(const it of items){if(!it.str||!it.str.trim())continue;const y=it.transform[5],x=it.transform[4];let r=rows.find(r=>Math.abs(r.y-y)<3);if(!r)rows.push(r={y,a:[]});r.a.push({x,s:it.str})}return rows.sort((a,b)=>b.y-a.y).map(r=>r.a.sort((a,b)=>a.x-b.x).map(o=>o.s).join(" ").replace(/\s+/g," ").trim()).filter(Boolean).join("\n")}
function result(type,pages,t0){const ok=pages.some(p=>p.text.replace(/\s/g,"").length>=20),res=parse(type,pages),me=[...new Set(pages.map(p=>p.method))],oc=pages.filter(p=>p.method=="ocr");
 return{readable:ok,pages:pages.total||pages.length,matches_expected_type:res.matches,fields:res.fields,engine:me.map(m=>m=="text"?"PDF.js text layer":"Tesseract.js OCR").join(" + "),
 proc:{methods:me,ocrConf:oc.length?Math.round(oc.reduce((a,p)=>a+p.conf,0)/oc.length):null,ms:Date.now()-t0,at:Date.now(),pageInfo:pages.map(p=>({n:p.n,method:p.method,chars:p.text.length,conf:Math.round(p.conf)})),text:pages.map(p=>"--- page "+p.n+" ("+p.method+") ---\n"+p.text).join("\n").slice(0,8000)}}}
/* ---- browser-only pipeline ---- */
const need=(k)=>{const u={pdf:["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",()=>window.pdfjsLib],tess:["https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",()=>window.Tesseract]}[k];return u[1]()?Promise.resolve():new Promise((r,j)=>{const s=document.createElement("script");s.src=u[0];s.onload=r;s.onerror=()=>j(new Error("Could not load "+(k=="pdf"?"PDF.js":"Tesseract.js")+" – check your internet connection"));document.head.appendChild(s)})};
let W,CB=()=>{};async function ocr(cv,msg,cb){CB=t=>cb(msg+" "+t);cb(msg+"…");await need("tess");W=W||await Tesseract.createWorker("eng",1,{logger:m=>{if(m.status=="recognizing text")CB(Math.round(m.progress*100)+"%")}});const{data}=await W.recognize(cv);return{text:data.text,conf:data.confidence}}
async function toCanvas(f){const b=await createImageBitmap(f),s=Math.max(1,Math.min(2.5,1800/b.width)),cv=document.createElement("canvas");cv.width=b.width*s;cv.height=b.height*s;const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);x.filter="grayscale(1) contrast(1.2)";x.drawImage(b,0,0,cv.width,cv.height);return cv}
async function process(file,type,cb=()=>{}){const t0=Date.now(),pages=[];
 if(/\.pdf$/i.test(file.name||"")||file.type=="application/pdf"){await need("pdf");pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,n=Math.min(doc.numPages,MAXP);
  for(let i=1;i<=n;i++){cb(`Reading PDF page ${i}/${n}`);const pg=await doc.getPage(i),tx=pdfLines((await pg.getTextContent()).items);if(tx.replace(/\s/g,"").length>=30){pages.push({n:i,text:tx,conf:98,method:"text"});continue}
   const vp=pg.getViewport({scale:2.5}),cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:x,viewport:vp}).promise;pages.push({n:i,...await ocr(cv,`OCR page ${i}/${n}`,cb),method:"ocr"})}pages.total=doc.numPages}
 else pages.push({n:1,...await ocr(await toCanvas(file),"OCR image",cb),method:"ocr"});
 return result(type,pages,t0)}
return{process,parse,pdfLines,result}});
