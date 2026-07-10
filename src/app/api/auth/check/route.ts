import { NextResponse } from 'next/server';
import { getSystemSetting } from '@/lib/db';

export async function GET(request: Request) {
  const customUser = getSystemSetting('admin_username');
  const customPass = getSystemSetting('admin_password');
  const isRequired = !!process.env.ADMIN_PASSWORD || !!customUser || !!customPass;
  
  if (!isRequired) {
    return NextResponse.json({ authenticated: true, required: false });
  }
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ authenticated: false, required: true });
  }
  
  const token = authHeader.substring(7);
  const savedToken = getSystemSetting('session_token');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const activeToken = savedToken || adminPassword;
  
  if (token === activeToken) {
    return NextResponse.json({ authenticated: true, required: true });
  }
  
  return NextResponse.json({ authenticated: false, required: true });
}
