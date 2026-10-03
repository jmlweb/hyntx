/** Static CSS and JS for the report. Contains no report data. */

export const CSS = `
:root{
  color-scheme:light dark;
  --bg:#ffffff;--surface:#f6f8fa;--border:#d0d7de;--text:#1f2328;--muted:#59636e;
  --accent:#0550ae;--high:#a40e26;--medium:#8a4600;--low:#1f6f3a;
  --s1:#2563eb;--s2:#c2410c;--s3:#0f766e;--s4:#7c3aed;
  --code-bg:#f0f3f6;--ok:#1f6f3a;--warn-bg:#fff4d6;--warn-border:#d4a72c;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0d1117;--surface:#151b23;--border:#3d444d;--text:#e6edf3;--muted:#9ea7b3;
  --accent:#79b8ff;--high:#ff8f9b;--medium:#f2b25e;--low:#6fd08c;
  --s1:#6ea8ff;--s2:#fb923c;--s3:#2dd4bf;--s4:#b794f6;
  --code-bg:#1b222c;--ok:#6fd08c;--warn-bg:#2b2208;--warn-border:#8a6d1a;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:62rem;margin:0 auto;padding:0 16px 48px}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1{font-size:1.5rem;margin:0}
h2{font-size:1.2rem;margin:2.5rem 0 .75rem;padding-bottom:.35rem;border-bottom:1px solid var(--border)}
h3{font-size:1rem;margin:0}
p{margin:.4rem 0}
.muted{color:var(--muted)}
.small{font-size:.875rem}
header.top{padding:24px 0 8px}
header.top .meta{color:var(--muted);font-size:.9rem;margin-top:.25rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:1rem 0 0;padding:0;list-style:none}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 12px}
.tile .v{font-size:1.35rem;font-weight:600;font-variant-numeric:tabular-nums}
.tile .l{font-size:.8rem;color:var(--muted)}
.notice{background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:6px;padding:10px 14px;margin:1rem 0}
.notice ul{margin:.25rem 0 0;padding-left:1.2rem}
.empty{background:var(--surface);border:1px dashed var(--border);border-radius:6px;padding:12px 14px;color:var(--muted)}
.summary{border-left:3px solid var(--accent);padding:2px 0 2px 12px;margin:1rem 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin:12px 0;break-inside:avoid}
.card header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.card h3{overflow-wrap:anywhere}
.badge{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;border:1px solid currentColor;border-radius:4px;padding:0 6px;white-space:nowrap}
.badge.high{color:var(--high)}.badge.medium{color:var(--medium)}.badge.low{color:var(--low)}
.badge.confirmed{color:var(--ok)}.badge.rejected{color:var(--high)}.badge.unclear{color:var(--muted)}
.finding{margin:.5rem 0 .25rem;overflow-wrap:anywhere}
.facts{color:var(--muted);font-size:.85rem;margin:0 0 .5rem}
.action{margin:.75rem 0 0}
.action .label{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:.875rem;font-weight:600}
.action .label span{overflow-wrap:anywhere;min-width:0}
pre{margin:.35rem 0 0;padding:10px 12px;background:var(--code-bg);border:1px solid var(--border);border-radius:6px;font:.85rem/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.ba{display:grid;grid-template-columns:1fr;gap:6px}
@media (min-width:640px){.ba{grid-template-columns:1fr 1fr}}
.ba .tag{display:flex;justify-content:space-between;align-items:center;min-height:26px;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
button.copy{display:none;font:inherit;font-size:.8rem;padding:2px 10px;border-radius:5px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer}
.js button.copy{display:inline-block}
button.copy:hover{border-color:var(--accent)}
details{margin:.6rem 0 0}
summary{cursor:pointer;color:var(--muted);font-size:.875rem}
summary:hover{color:var(--text)}
blockquote{margin:.5rem 0;padding:.1rem 0 .1rem 10px;border-left:2px solid var(--border);color:var(--muted);font-size:.875rem;overflow-wrap:anywhere}
blockquote .src{display:block;font-size:.78rem}
ol.steps{margin:.4rem 0 0;padding-left:1.4rem}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px}
figure.chart{margin:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;break-inside:avoid}
figure.chart figcaption{font-size:.875rem;font-weight:600;margin-bottom:4px}
figure.chart svg{width:100%;height:auto;display:block}
svg .grid{stroke:var(--border);stroke-width:1}
svg .tick{fill:var(--muted);font-size:10px;font-family:inherit}
svg rect.s1,.swatch.s1{fill:var(--s1);background:var(--s1)}
svg rect.s2,.swatch.s2{fill:var(--s2);background:var(--s2)}
svg rect.s3,.swatch.s3{fill:var(--s3);background:var(--s3)}
svg rect.s4,.swatch.s4{fill:var(--s4);background:var(--s4)}
svg .line{fill:none;stroke-width:2;stroke-linejoin:round}
svg .line.s1{stroke:var(--s1)}svg .line.s2{stroke:var(--s2)}svg .line.s3{stroke:var(--s3)}
svg .dot.s1{fill:var(--s1)}svg .dot.s2{fill:var(--s2)}svg .dot.s3{fill:var(--s3)}
ul.legend{display:flex;gap:12px;flex-wrap:wrap;list-style:none;margin:4px 0 0;padding:0;font-size:.8rem;color:var(--muted)}
.swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.875rem;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:5px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-weight:600;color:var(--muted);white-space:nowrap}
td.num,th.num{text-align:right}
td.name{overflow-wrap:anywhere}
.bar{display:block;height:6px;background:var(--s1);border-radius:3px;min-width:1px;margin-top:3px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;align-items:start}
.ep{padding:8px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}
.ep:last-child{border-bottom:0}
.ep .type{font-size:.78rem;font-weight:600;color:var(--muted);margin-right:6px}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:.85rem}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media print{
  body{font-size:11pt}
  button.copy,.js button.copy{display:none}
  .card,figure.chart{break-inside:avoid}
  h2{break-after:avoid}
}
`;

export const JS = `
(function(){
  var root=document.documentElement;
  root.classList.add('js');
  var live=document.getElementById('live');
  function fallbackCopy(text){
    var area=document.createElement('textarea');
    area.value=text;area.setAttribute('readonly','');
    area.style.position='fixed';area.style.opacity='0';
    document.body.appendChild(area);area.select();
    var ok=false;
    try{ok=document.execCommand('copy');}catch(e){ok=false;}
    document.body.removeChild(area);
    return ok;
  }
  function copyText(text){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(function(){return true;},function(){return fallbackCopy(text);});
    }
    return Promise.resolve(fallbackCopy(text));
  }
  document.addEventListener('click',function(event){
    var target=event.target;
    if(!(target instanceof Element))return;
    var button=target.closest('button.copy');
    if(!button)return;
    var source=document.getElementById(button.getAttribute('data-copy-target')||'');
    if(!source)return;
    copyText(source.textContent||'').then(function(ok){
      var original=button.getAttribute('data-label')||button.textContent;
      button.setAttribute('data-label',original);
      button.textContent=ok?'Copied':'Copy failed';
      if(live)live.textContent=ok?'Copied to clipboard':'Copy failed';
      setTimeout(function(){button.textContent=original;if(live)live.textContent='';},1800);
    });
  });
  window.addEventListener('beforeprint',function(){
    document.querySelectorAll('details').forEach(function(d){d.setAttribute('data-was-open',d.open?'1':'0');d.open=true;});
  });
  window.addEventListener('afterprint',function(){
    document.querySelectorAll('details').forEach(function(d){d.open=d.getAttribute('data-was-open')==='1';});
  });
})();
`;
