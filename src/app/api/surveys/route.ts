import { NextRequest, NextResponse } from 'next/server';
import { createSurvey } from '@/app/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';

    if (!title) {
      return NextResponse.json({ success: false, error: 'Tytuł jest wymagany.' }, { status: 400 });
    }

    const result = await createSurvey(title, description || undefined);

    if (result && 'id' in result && result.id) {
      return NextResponse.json({ success: true, id: result.id });
    }

    const error = (result && 'error' in result && result.error) || 'Nie udało się utworzyć ankiety.';
    return NextResponse.json({ success: false, error }, { status: 500 });
  } catch (err) {
    console.error('[api/surveys] Błąd tworzenia ankiety:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Wystąpił nieznany błąd.' },
      { status: 500 }
    );
  }
}