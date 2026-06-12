const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.csv':'text/csv'};
http.createServer((req,res)=>{
  let f=req.url.split('?')[0];
  if(f==='/')f='/index.html';
  if(f.endsWith('/'))f+='index.html';
  f=path.join(__dirname,decodeURIComponent(f));
  fs.stat(f,(er,st)=>{
    if(!er&&st.isDirectory())f=path.join(f,'index.html');
    fs.readFile(f,(e,d)=>{
      if(e){res.writeHead(404);res.end('404');return;}
      res.writeHead(200,{'Content-Type':types[path.extname(f)]||'text/plain'});
      res.end(d);
    });
  });
}).listen(8731,()=>console.log('http://localhost:8731'));
