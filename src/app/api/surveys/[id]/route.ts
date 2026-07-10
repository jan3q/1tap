import { NextRequest, NextResponse } from 'next/server';
import { updateSurveySchema } from '@/app/actions';
import { SurveySchema } from '@/types';
import { cookies } from 'next/headers';
import { getSystemSetting } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const customUser = getSystemSetting('admin_username');
    const customPass = getSystemSetting('admin_password');
    const isAuthRequired = !!process.env.ADMIN_PASSWORD || !!customUser || !!customPass;
    const activeToken = getSystemSetting('session_token') || process.env.ADMIN_PASSWORD;

    if (isAuthRequired && (!activeToken || token !== activeToken)) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const schema: SurveySchema = body?.schema;
    const title = typeof body?.title === 'string' ? body.title : '';
    const redirectUrl = typeof body?.redirectUrl === 'string' ? body.redirectUrl : null;
    const webhookUrl = typeof body?.webhookUrl === 'string' ? body.webhookUrl : null;
    const description = typeof body?.description === 'string' ? body.description : null;

    if (!schema || !Array.isArray(schema.questions)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy schemat ankiety.' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ success: false, error: 'Tytuł jest wymagany.' }, { status: 400 });
    }

    await updateSurveySchema(id, schema, title, redirectUrl, webhookUrl, description);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/surveys/[id]] Błąd zapisu ankiety:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Wystąpił nieznany błąd.' },
      { status: 500 }
    );
  }
}