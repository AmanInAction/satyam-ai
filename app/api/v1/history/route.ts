import { NextRequest, NextResponse } from 'next/server';
import { defaultDb } from '@/src/lib/db/database';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-User-Id',
    },
  });
}

export async function GET(req: NextRequest) {
  const requestId = generateRequestId();
  const sessionInfo = getUserIdFromRequest(req);

  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    const search = url.searchParams.get('search') || undefined;
    const detailId = url.searchParams.get('id') || undefined;

    // Single item detail lookup
    if (detailId) {
      const item = defaultDb.getAnalysisById(detailId, sessionInfo.userId);
      if (!item) {
        return createErrorResponse(404, 'NOT_FOUND', 'Analysis record not found.', requestId);
      }
      let fullReport: unknown = null;
      try {
        fullReport = JSON.parse(item.full_result_json);
      } catch {
        // ignore
      }
      const response = NextResponse.json({
        analysis: {
          ...item,
          full_result: fullReport,
        },
      });
      return attachUserSessionHeaders(response, sessionInfo);
    }

    // List lookup
    const analyses = defaultDb.getAnalysesByUser(sessionInfo.userId, limit, offset, search);

    const summaries = analyses.map((a) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(a.full_result_json);
      } catch {
        // ignore
      }
      return {
        id: a.id,
        userId: a.user_id,
        inputType: a.input_type,
        inputPreview: a.input_preview,
        verdict: a.verdict,
        scamRisk: a.scam_risk,
        claimVerdict: a.claim_verdict,
        confidenceScore: a.confidence_score,
        reasonsSummary: a.reasons_summary,
        recommendedAction: parsed?.recommended_action || 'Review details',
        createdAt: a.created_at,
      };
    });

    const response = NextResponse.json({
      userId: sessionInfo.userId,
      total: summaries.length,
      analyses: summaries,
    });

    return attachUserSessionHeaders(response, sessionInfo);
  } catch {
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Unable to retrieve analysis history.', requestId);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = generateRequestId();
  const sessionInfo = getUserIdFromRequest(req);

  try {
    const url = new URL(req.url);
    const analysisId = url.searchParams.get('id');

    if (analysisId) {
      defaultDb.deleteAnalysis(analysisId, sessionInfo.userId);
      return NextResponse.json({ success: true, message: `Deleted analysis ${analysisId}` });
    }

    // Clear all analyses for current user
    defaultDb.clearAnalyses(sessionInfo.userId);
    return NextResponse.json({ success: true, message: 'All analysis history cleared successfully.' });
  } catch {
    return createErrorResponse(500, 'DELETE_FAILED', 'Unable to delete analysis history.', requestId);
  }
}
