import { NextRequest } from 'next/server';
import { defaultCreditLedger } from './ledger';
import { getUserIdFromRequest, UserSessionInfo } from './userSession';
import { CreditReservation } from './types';
import { CREDIT_COSTS } from './config';

export interface CreditGuardResult {
  sessionInfo: UserSessionInfo;
  reservation: CreditReservation | null;
  cost: number;
}

export async function checkAndReserveCredits(
  req: NextRequest,
  analysisType: 'text' | 'url' | 'image'
): Promise<CreditGuardResult> {
  const sessionInfo = getUserIdFromRequest(req);
  const cost = CREDIT_COSTS[analysisType];

  const reservation = await defaultCreditLedger.reserveCredits(
    sessionInfo.userId,
    cost,
    analysisType
  );

  return {
    sessionInfo,
    reservation,
    cost,
  };
}

export async function finalizeCreditUsage(
  reservation: CreditReservation | null,
  analysisId: string,
  success: boolean,
  failureReason?: string
): Promise<number> {
  if (!reservation) return 0;

  if (success) {
    await defaultCreditLedger.commitReservation(reservation.reservationId, analysisId);
  } else {
    await defaultCreditLedger.releaseReservation(
      reservation.reservationId,
      failureReason || 'analysis_failed'
    );
  }

  const balance = await defaultCreditLedger.getBalance(reservation.userId);
  return balance.available;
}
