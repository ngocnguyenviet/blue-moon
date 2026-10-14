import {app} from './app.js';
import {config,validateConfig} from './config.js';
import {db} from './db.js';
validateConfig();
const server=app.listen(config.port,'0.0.0.0',()=>console.log(`BlueMoon http://localhost:${config.port}`));
const stop=()=>server.close(async()=>{await db.$disconnect();process.exit(0);});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
