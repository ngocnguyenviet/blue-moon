import 'dotenv/config';
export const config={
 port:Number(process.env.PORT||3000),appUrl:process.env.APP_URL||'http://localhost:3000',
 production:process.env.NODE_ENV==='production',
 demo:process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production',
 bridgeSecret:process.env.BRIDGE_SECRET||'',
 scriptUrl:process.env.APPS_SCRIPT_URL||'',
 allowlist:(process.env.EMAIL_ALLOWLIST||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),
 vnpayCode:process.env.VNPAY_TMN_CODE||'',vnpaySecret:process.env.VNPAY_HASH_SECRET||'',
 vnpayUrl:process.env.VNPAY_URL||'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
};
export function validateConfig(){if(config.production){for(const key of ['DATABASE_URL','BRIDGE_SECRET','APP_URL'])if(!process.env[key])throw new Error(`Missing ${key}`);if(!config.appUrl.startsWith('https://'))throw new Error('APP_URL requires HTTPS');if(config.bridgeSecret.length<32)throw new Error('BRIDGE_SECRET must contain 32+ characters');}}
