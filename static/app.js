let dataRows=[], resultRows=[], lastResult=null;
const $=id=>document.getElementById(id);
const palette=["#1769aa","#20a486","#f59e0b","#e0528e","#7c5cff","#e4572e","#3b82f6","#64748b"];

$("clusters").addEventListener("input",()=>{$("kValue").textContent=$("clusters").value});
$("algorithm").addEventListener("change",()=>{
  $("clusterControl").style.opacity=$("algorithm").value==="dbscan"?"0.45":"1";
});
$("sampleBtn").addEventListener("click", async()=>{
  try{
    const r=await fetch("/api/sample"); const j=await r.json();
    dataRows=j.rows; $("fileStatus").textContent=`Sample dataset loaded: ${dataRows.length} students`;
    clearError(); renderTable(dataRows);
  }catch(e){showError(e.message)}
});
$("fileInput").addEventListener("change", async e=>{
  const file=e.target.files[0]; if(!file)return;
  try{
    const text=await file.text(); dataRows=parseCSV(text);
    $("fileStatus").textContent=`${file.name} • ${dataRows.length} records`;
    clearError(); renderTable(dataRows);
  }catch(err){showError(err.message)}
});
$("runBtn").addEventListener("click", async()=>{
  if(!dataRows.length){showError("Please load sample data or upload a CSV first.");return}
  $("runBtn").textContent="Running ML...";
  try{
    const r=await fetch("/api/cluster",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({rows:dataRows,algorithm:$("algorithm").value,clusters:+$("clusters").value})});
    const j=await r.json(); if(!r.ok)throw Error(j.error||"Clustering failed");
    lastResult=j; resultRows=j.rows;
    updateStats(j); drawScatter(j.rows,j.summary); renderSummary(j.summary); renderTable(j.rows); clearError();
  }catch(e){showError(e.message)} finally{$("runBtn").textContent="Run Clustering ↗"}
});
$("downloadBtn").addEventListener("click",()=>{
  if(!resultRows.length){showError("Run clustering first.");return}
  const cols=Object.keys(resultRows[0]); const csv=[cols.join(","),...resultRows.map(r=>cols.map(c=>csvCell(r[c])).join(","))].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="student_clustering_results.csv";a.click();
});
$("search").addEventListener("input",()=>renderTable(resultRows.length?resultRows:dataRows,$("search").value.toLowerCase()));

function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/); if(lines.length<2)throw Error("CSV is empty.");
  const headers=splitCSV(lines[0]); return lines.slice(1).filter(x=>x.trim()).map(line=>{
    const vals=splitCSV(line), obj={}; headers.forEach((h,i)=>obj[h.trim()]=vals[i]??""); return obj;
  });
}
function splitCSV(line){let out=[],cur="",q=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===","&&!q){out.push(cur);cur=""}else cur+=c}out.push(cur);return out}
function updateStats(j){$("total").textContent=j.total_students;$("groups").textContent=j.summary.length;$("silhouette").textContent=j.metrics.silhouette==null?"—":j.metrics.silhouette.toFixed(3);$("db").textContent=j.metrics.davies_bouldin==null?"—":j.metrics.davies_bouldin.toFixed(3)}
function renderSummary(s){
  $("summaryCards").innerHTML=s.map(x=>`<div class="summary-item">
    <div class="summary-top"><span>Cluster ${x.cluster}</span><span>${x.count} students</span></div>
    <div class="summary-meta"><span>Attendance: <b>${x.attendance}%</b></span><span>Study: <b>${x.study_hours}h</b></span><span>Final: <b>${x.final_score}</b></span><span>Avg score: <b>${x.avg_score}</b></span></div>
    <div class="bar"><span style="width:${Math.min(100,x.avg_score)}%"></span></div></div>`).join("");
}
function renderTable(rows,filter=""){
  const r=rows.filter(x=>!filter||JSON.stringify(x).toLowerCase().includes(filter));
  $("studentTable").innerHTML=r.length?r.slice(0,250).map(x=>`<tr><td>${x.StudentID??"—"}</td><td>${x.Name??"—"}</td><td>${fmt(x.Attendance)}</td><td>${fmt(x.StudyHours)}</td><td>${fmt(x.AssignmentScore)}</td><td>${fmt(x.MidtermScore)}</td><td>${fmt(x.FinalScore)}</td><td>${x.Cluster?`<span class="cluster-pill">Group ${x.Cluster}</span>`:"—"}</td></tr>`).join(""):`<tr><td colspan="8" class="empty">No matching students.</td></tr>`;
}
function fmt(v){let n=Number(v);return Number.isFinite(n)?n.toFixed(1):v??"—"}
function drawScatter(rows,summary){
  const c=$("scatter"),ctx=c.getContext("2d"),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=470;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const xs=rows.map(r=>+r.PCA1),ys=rows.map(r=>+r.PCA2),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const pad={l:45,r:20,t:20,b:40}; const px=x=>pad.l+(x-minx)/(maxx-minx||1)*(w-pad.l-pad.r);const py=y=>h-pad.b-(y-miny)/(maxy-miny||1)*(h-pad.t-pad.b);
  ctx.strokeStyle="#e8edf4";ctx.lineWidth=1;for(let i=0;i<5;i++){let x=pad.l+i*(w-pad.l-pad.r)/4,y=pad.t+i*(h-pad.t-pad.b)/4;ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,h-pad.b);ctx.stroke();ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke()}
  rows.forEach(r=>{ctx.beginPath();ctx.arc(px(+r.PCA1),py(+r.PCA2),5,0,Math.PI*2);ctx.fillStyle=palette[((+r.Cluster||1)-1)%palette.length];ctx.globalAlpha=.82;ctx.fill();ctx.globalAlpha=1});
  ctx.fillStyle="#7c889a";ctx.font="11px Segoe UI";ctx.fillText("PCA 1",w/2-15,h-10);ctx.save();ctx.translate(13,h/2+20);ctx.rotate(-Math.PI/2);ctx.fillText("PCA 2",0,0);ctx.restore();
  $("legend").innerHTML=summary.map(x=>`<span><i style="background:${palette[(x.cluster-1)%palette.length]}"></i>Group ${x.cluster} (${x.count})</span>`).join("");
}
function showError(m){$("error").style.display="block";$("error").textContent=m}
function clearError(){$("error").style.display="none"}
window.addEventListener("resize",()=>{if(lastResult)drawScatter(lastResult.rows,lastResult.summary)});
$("sampleBtn").click();
