const r=require('./run.json');const out=[];
function walk(s){(s.suites||[]).forEach(walk);(s.specs||[]).forEach(sp=>{const res=sp.tests[0].results[0]||{};out.push({title:sp.title,file:sp.file,status:sp.tests[0].status==='skipped'?'skipped':res.status,err:(res.error&&res.error.message||'').replace(/\x1b\[[0-9;]*m/g,'').split('\n').slice(0,8).join(' | ').slice(0,420)});});}
walk(r);
const c={};out.forEach(o=>c[o.status]=(c[o.status]||0)+1);console.log(JSON.stringify(c),'total',out.length, 'duration(s)', Math.round(r.stats.duration/1000));
out.filter(o=>o.status!=='passed'&&!/a11y-theme.*Accessibility/.test(o.file+o.title)||(o.file.includes('a11y')&&o.status!=='passed'&&!/label-content-name-mismatch/.test(o.err))).forEach(o=>console.log(o.status.toUpperCase(),o.file,'>',o.title,'\n   ',o.err));
