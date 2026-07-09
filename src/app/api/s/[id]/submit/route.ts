import { NextRequest, NextResponse } from 'next/server';
import { submitSurveyResponse } from '@/app/actions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const result = await submitSurveyResponse(id, body);
    
    return NextResponse.json({ 
      success: true, 
      redirectUrl: result.redirectUrl 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: (err as Error).message 
    }, { 
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
