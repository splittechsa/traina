// Explicit staging start avoids silently inheriting a retired LAN API from .env.
const {spawn}=require('node:child_process'),path=require('node:path');
const mobile=path.resolve(__dirname,'../apps/mobile');
const child=spawn(process.execPath,[path.join(mobile,'node_modules/expo/bin/cli'),'start','--go',...process.argv.slice(2)],{cwd:mobile,env:{...process.env,EXPO_PUBLIC_API_URL:'https://traina-staging-api.vercel.app'},stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});
child.on('error',()=>{console.error('Could not start the installed Expo CLI. Run npm ci in apps/mobile.');process.exitCode=1;});
