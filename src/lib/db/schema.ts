export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  token: string;
  user_id: string;
  expires_at: number;
  created_at: string;
}

export interface DbAnalysis {
  id: string;
  user_id: string;
  input_type: 'text' | 'url' | 'image';
  input_preview: string;
  verdict: string;
  scam_risk: string;
  claim_verdict: string;
  confidence_score: number;
  reasons_summary: string;
  full_result_json: string;
  created_at: string;
}

export interface DbTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reason: string;
  idempotency_key: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface DbUserBalance {
  user_id: string;
  balance: number;
  has_received_free_grant: number;
  updated_at: string;
}
