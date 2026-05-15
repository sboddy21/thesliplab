import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function rm(dir){if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true,force:true})}
function copyFile(src,dest){if(!fs.existsSync(src))return;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest)}
function copyDir(src,dest){if(!fs.existsSync(src))return;fs.mkdirSync(dest,{recursive:true});for(const item of fs.readdirSync(src)){const from=path.join(src,item);const to=path.join(dest,item);const stat=fs.statSync(from);if(stat.isDirectory())copyDir(from,to);else copyFile(from,to)}}

rm(DIST);
fs.mkdirSync(DIST,{recursive:true});

for(const file of fs.readdirSync(ROOT)){
  if(file.endsWith(".html")||file.endsWith(".js")||file.endsWith(".css")||file==="vercel.json"){
    copyFile(path.join(ROOT,file),path.join(DIST,file));
  }
}

copyDir(path.join(ROOT,"data"),path.join(DIST,"data"));
copyDir(path.join(ROOT,"assets"),path.join(DIST,"assets"));

console.log("THE SLIP LAB STATIC BUILD COMPLETE");
