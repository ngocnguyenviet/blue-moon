import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from './db.js';
import {passwordValid} from './auth.js';
import {audit,lock} from './finance.js';
import {ensure} from './domain.js';

export async function bootstrapManager(input:{email:string;phone:string;name:string;password:string}){
 const data=z.object({email:z.email().transform(v=>v.trim().toLowerCase()),phone:z.string().regex(/^(?:\+84|0)\d{9,10}$/),name:z.string().trim().min(1).max(200),password:z.string()}).parse(input);
 passwordValid(data.password);
 return db.$transaction(async tx=>{await lock(tx,'staff-status');ensure(await tx.user.count({where:{role:'MANAGER'}})===0,'Đã có quản lý; dùng giao diện để cấp tài khoản');const user=await tx.user.create({data:{...data,password:await bcrypt.hash(data.password,12),role:'MANAGER',mustChange:true,verified:false}});await audit(tx,'BOOTSTRAP','CREATE_MANAGER',user.id,{});return user.id;});
}
if(process.argv[1]?.replace(/\\/g,'/').match(/\/bootstrap\.(ts|js)$/)){
 bootstrapManager({email:process.env.BOOTSTRAP_EMAIL||'',phone:process.env.BOOTSTRAP_PHONE||'',name:process.env.BOOTSTRAP_NAME||'Quản lý BlueMoon',password:process.env.BOOTSTRAP_PASSWORD||''})
 .then(()=>console.log('Đã tạo quản lý. Đăng nhập, đổi mật khẩu và xác minh email trước khi sử dụng.'))
 .catch(()=>{console.error('Chưa tạo tài khoản. Kiểm tra biến BOOTSTRAP, kết nối và bảo đảm chưa có quản lý.');process.exitCode=1;})
 .finally(()=>db.$disconnect());
}
