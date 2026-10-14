import { ReasonItem, ScamVerdict, RiskLevel } from '../validation/schemas';

export interface RuleEvaluationResult {
  matchedReasons: ReasonItem[];
  suggestedVerdict: ScamVerdict;
  suggestedRiskLevel: RiskLevel;
  actions: string[];
  limitations: string[];
}

export interface ScamRule {
  id: string;
  name: string;
  description: string;
  evaluate: (text: string, lower: string) => ReasonItem | null;
  recommendedAction?: string;
  severity: 'high' | 'medium';
}

/**
 * India-relevant deterministic scam rules with strict contextual checks
 * to distinguish genuine scams from routine transactional notices and counterexamples.
 */
export const DETERMINISTIC_SCAM_RULES: ScamRule[] = [
  // 1. UPI Receive PIN Trap (Entering PIN to receive funds is always fraudulent)
  {
    id: 'upi_receive_pin_trap',
    name: 'UPI Receive PIN Trap',
    description: 'Solicits UPI PIN or QR scan under the false pretense of receiving money or refund.',
    severity: 'high',
    recommendedAction:
      'Never enter your UPI PIN or scan a QR code to receive money. UPI PIN is only required to send or deduct money.',
    evaluate: (_text, lower) => {
      const mentionsUpi = /upi|gpay|google pay|phonepe|paytm|bhim/i.test(lower);
      const mentionsPin = /pin|upi pin|password/i.test(lower);
      const claimsReceiving =
        /to receive|to accept|to get money|to credit|for refund|receive payment|paisa pane ke liye|cashback pane|receive cashback/i.test(
          lower
        );
      const claimsQrScanToReceive =
        /scan qr (to|and) (receive|get|claim)|qr code scan karein paisa (pane|lene)/i.test(lower);

      // Check for benign counterexample (e.g., standard "You paid Rs X using UPI PIN" or "Never share your UPI PIN")
      const isBenignNotice =
        /never share your upi pin|do not enter upi pin to receive|debited|sent to|paid rs|bill payment successful/i.test(
          lower
        );

      if ((mentionsUpi && mentionsPin && claimsReceiving && !isBenignNotice) || claimsQrScanToReceive) {
        return {
          code: 'upi_receive_pin_trap',
          title: 'UPI Payment / Receive PIN Trap',
          explanation:
            'Claims you must enter a UPI PIN or scan a QR code to receive money or cashback. In UPI architecture, PIN is NEVER required to receive money.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 2. Credential & OTP Solicitation (Scammers asking user to send/tell OTP)
  {
    id: 'credential_otp_solicitation',
    name: 'Credential or OTP Solicitation',
    description: 'Demands or asks the recipient to share or forward an OTP, PIN, or netbanking password.',
    severity: 'high',
    recommendedAction:
      'Never share your OTP, PIN, or password with anyone, including bank executives or customer care.',
    evaluate: (_text, lower) => {
      const mentionsOtp = /\botp\b|one[- ]time password|verification code|\bcvv\b/i.test(lower);
      const asksToShare =
        /share otp|send (the )?otp|tell (the )?otp|provide (the )?otp|forward (the )?otp|otp share karein|otp batayein|otp bhejein|verify otp with officer/i.test(
          lower
        );

      // Benign check: legitimate bank SMS say "Do not share OTP with anyone" or "Bank never calls asking for OTP"
      const isLegitimateWarning =
        /do not share|never share|not share with anyone|bank never calls|kisi ke sath share na karein/i.test(lower);

      if (mentionsOtp && asksToShare && !isLegitimateWarning) {
        return {
          code: 'credential_otp_solicitation',
          title: 'Credential or OTP Solicitation',
          explanation:
            'Directly requests that you share, send, or disclose an OTP or confidential code. Legitimate institutions never ask for your OTP.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 3. Urgent KYC & Electricity Disconnection Threats
  {
    id: 'kyc_electricity_threat',
    name: 'KYC / Utility Disconnection Threat',
    description: 'Threatens immediate disconnection of electricity, SIM, or bank account for pending KYC or unpaid bill.',
    severity: 'high',
    recommendedAction:
      'Contact your power utility or bank via verified official helpline numbers or official mobile apps, never numbers sent in SMS.',
    evaluate: (_text, lower) => {
      const mentionsUtility =
        /electricity|power supply|bijli|bijlee|बिजली|sim card|सिम|bank account|खाता|pan card|पैन|aadhaar|आधार/i.test(lower);
      const mentionsDisconnectionOrBlock =
        /disconnected tonight|disconnected at|power will be cut|will be blocked|will be suspended|service stop|band ho jayega|kat diya jayega|काट दी जाएगी|काट दिया जाएगा|ब्लॉक|बंद हो जाएगा/i.test(
          lower
        );
      const hasUrgencyOrCallOfficer =
        /immediately|within 24 hours|call officer|contact electricity officer|call immediately|turant sampark karein|तुरंत|संपर्क करें|अधिकारी|call \d{10}|\b\d{10}\b/i.test(
          lower
        );

      // Benign check: normal bills state "Dear customer, your bill of Rs X is generated, due date is 25th" without threats
      const isStandardBillReminder =
        /bill generated|e-statement|due date is|bill receipt|payment received with thanks/i.test(lower) &&
        !mentionsDisconnectionOrBlock;

      if (mentionsUtility && mentionsDisconnectionOrBlock && hasUrgencyOrCallOfficer && !isStandardBillReminder) {
        return {
          code: 'kyc_electricity_threat',
          title: 'Urgent Disconnection / KYC Threat',
          explanation:
            'Uses high-pressure scare tactics threatening immediate disconnection of electricity, SIM, or bank accounts unless you call an unknown number.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 4. Digital Arrest / Law Enforcement Extortion
  {
    id: 'digital_arrest_extortion',
    name: 'Digital Arrest / Law Enforcement Impersonation',
    description: 'Impersonates police, CBI, customs, or court threatening arrest over illegal parcels or money laundering.',
    severity: 'high',
    recommendedAction:
      'Law enforcement agencies in India never conduct "digital arrests" via video call or demand money to clear cases. Report immediately to cybercrime.gov.in (Helpline 1930).',
    evaluate: (_text, lower) => {
      const mentionsAgency =
        /cbi|crime branch|police|customs officer|narcotics|ed|enforcement directorate|supreme court|mha/i.test(lower);
      const mentionsThreat =
        /digital arrest|illegal parcel|drugs found|passport seized|arrest warrant|money laundering case|transfer (surety|bail) amount/i.test(
          lower
        );

      if (mentionsAgency && mentionsThreat) {
        return {
          code: 'digital_arrest_extortion',
          title: 'Digital Arrest / Law Enforcement Impersonation',
          explanation:
            'Matches known "Digital Arrest" extortion tactics. Indian law enforcement and judiciary never arrest people over Skype/WhatsApp or demand money deposits to verify innocence.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 5. Part-time Job / YouTube Video Liking / Task Scams
  {
    id: 'part_time_task_scam',
    name: 'Part-time Task & YouTube Liking Scam',
    description: 'Promises unrealistic daily income for liking videos, rating hotels, or doing small online tasks.',
    severity: 'high',
    recommendedAction:
      'Do not pay advance deposits or fee to unlock "VIP tasks". Legitimate employers do not pay high daily sums for social media likes.',
    evaluate: (_text, lower) => {
      const mentionsEarning =
        /earn\s*(rs|inr|\$)?\s*\d{3,5}(\s*(to|-)\s*\d{3,5})?\s*(per day|daily|every day|\/day)|ghar baithe kamayein|kamayein\s*\d{3,5}/i.test(
          lower
        );
      const mentionsTasks =
        /like youtube (videos|channels)|hotel review|google map review|telegram task|vip task|part time job|work from home job/i.test(
          lower
        );
      const mentionsContact =
        /whatsapp|telegram|contact hr|join now/i.test(lower);

      // Benign check: normal career notices
      const isLegitimateJobNotice =
        /job application received|interview scheduled|resume received|recruitment drive at campus/i.test(lower);

      if (mentionsEarning && mentionsTasks && (mentionsContact || lower.includes('daily')) && !isLegitimateJobNotice) {
        return {
          code: 'part_time_task_scam',
          title: 'Part-Time Task / Video Liking Scam',
          explanation:
            'Promises exorbitant daily earnings for trivial tasks (e.g. liking YouTube videos). Scammers typically pay small sums initially before demanding large deposits for "premium tasks".',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 6. Lottery, KBC, and Unsolicited Prize Scams
  {
    id: 'lottery_prize_scam',
    name: 'Lottery / KBC Unsolicited Prize Scam',
    description: 'Falsely claims you have won Kaun Banega Crorepati (KBC), lucky draw, or foreign lottery.',
    severity: 'high',
    recommendedAction:
      'Never pay processing fees or GST to claim lottery winnings. Genuine lotteries never demand advance processing charges.',
    evaluate: (_text, lower) => {
      const mentionsLottery =
        /kbc lottery|kaun banega crorepati|lucky draw winner|won (rs|inr|\$)?\s*\d{5,8}|lottery number|congratulations you won/i.test(
          lower
        );
      const mentionsClaimProcess =
        /whatsapp|call manager|claim department|processing fee|tax fee|deposit fee|sampark karein/i.test(lower);

      // Benign check: legitimate marketing discounts
      const isBenignPromotion =
        /discount on purchase|coupon code|use code|cashback on minimum purchase|t&c apply/i.test(lower) &&
        !/won (rs|inr)?\s*\d{5,8}|kbc/i.test(lower);

      if (mentionsLottery && mentionsClaimProcess && !isBenignPromotion) {
        return {
          code: 'lottery_prize_scam',
          title: 'Fake Lottery / Prize Scam',
          explanation:
            'Claims you have won a lottery or lucky draw (e.g., KBC) you never participated in, asking you to contact an unknown manager or pay claim fees.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 7. General High-Pressure Urgency + Unsolicited Payment Request
  {
    id: 'general_urgency_financial_pressure',
    name: 'Urgency & Unsolicited Financial Pressure',
    description: 'Demands immediate transfer under arbitrary threats or time limits.',
    severity: 'medium',
    recommendedAction:
      'Take time to verify independently. Genuine organizations do not demand immediate money transfers under arbitrary 1-hour deadlines.',
    evaluate: (_text, lower) => {
      const hasUrgency =
        /immediate|urgent|within (1|2|24) hour|expires in \d+|hurry up|action required now|aaj hi karein/i.test(lower);
      const hasMoneyTransfer =
        /transfer fee|pay fee|send money|deposit amount|pay immediately|charges apply/i.test(lower);
      const hasThreat =
        /penalty|legal notice|fine will be charged|account closed/i.test(lower);

      if (hasUrgency && hasMoneyTransfer && hasThreat) {
        return {
          code: 'general_urgency_financial_pressure',
          title: 'High-Pressure Financial Demand',
          explanation:
            'Uses manufactured urgency combined with threats of penalties or account closure to force an impulsive payment.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 8. Malicious APK File / Side-Loading RAT Scam
  {
    id: 'malicious_apk_scam',
    name: 'Malicious APK File Download Scam',
    description: 'Directs user to install an unverified Android APK package outside official app stores.',
    severity: 'high',
    recommendedAction:
      'Never download or install .apk files received via SMS or WhatsApp. Only install applications from Google Play Store or Apple App Store.',
    evaluate: (_text, lower) => {
      const mentionsApk = /\.apk\b|download apk|install apk|apk file|apk link/i.test(lower);
      const mentionsContext =
        /update|bill|yono|challan|reward|kyc|electricity|courier|delivery|pan card|bank/i.test(lower);

      // Benign check: official store references
      const isOfficialStore =
        /play\.google\.com|google play store|apple app store|apps\.apple\.com/i.test(lower);

      if (mentionsApk && mentionsContext && !isOfficialStore) {
        return {
          code: 'malicious_apk_scam',
          title: 'Malicious APK File / RAT Malware Lure',
          explanation:
            'Directs user to side-load an unofficial .apk file. Indian cyber safety advisories (CERT-In) warn that fake utility and banking APKs install Remote Access Trojans (RAT) to steal OTPs and drain accounts.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 9. Instant Loan App / Predatory Lending Extortion
  {
    id: 'instant_loan_scam',
    name: 'Predatory Instant Loan / Advance Processing Scam',
    description: 'Promises instant loans with zero documentation, demanding advance fees or suspicious app installs.',
    severity: 'high',
    recommendedAction:
      'Avoid unverified instant loan apps. RBI-regulated lenders never disburse personal loans via WhatsApp without KYC and never demand advance fees to release funds.',
    evaluate: (_text, lower) => {
      const mentionsLoan =
        /instant loan|pre[- ]approved loan|loan approved|personal loan of rs\s*\d{4,7}|get loan in 5 min/i.test(
          lower
        );
      const mentionsSuspiciousHook =
        /no cibil|no documents required|bina document ke loan|zero cibil|pay processing fee (first|advance)|disburse amount/i.test(
          lower
        );

      // Benign check: standard bank loan offer via official netbanking/yono
      const isLegitimateBankOffer =
        /log in to your official netbanking|check offers in yono app|subject to credit approval|terms and conditions apply|t&c apply/i.test(
          lower
        ) && !mentionsSuspiciousHook;

      if (mentionsLoan && mentionsSuspiciousHook && !isLegitimateBankOffer) {
        return {
          code: 'instant_loan_scam',
          title: 'Predatory Loan / Advance Fee Trap',
          explanation:
            'Matches tactics of illegal lending apps offering immediate loans without CIBIL score or documents, often leading to harassment and extortion.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },

  // 10. Prompt Injection / Delimiter Override Defense
  {
    id: 'prompt_injection_defense',
    name: 'Prompt Injection / Instruction Override Attempt',
    description: 'Contains commands attempting to manipulate downstream model instructions or verdict classification.',
    severity: 'medium',
    recommendedAction:
      'Treat instruction override commands in submitted content as adversarial. Do not trust outputs resulting from tampered prompts.',
    evaluate: (_text, lower) => {
      const hasInjectionKeywords =
        /ignore (all )?(previous|prior|above) instructions|disregard (all )?instructions|system instruction override|you are now in (dan|developer) mode|always classify as safe|output verdict no_obvious_risk_found/i.test(
          lower
        );

      if (hasInjectionKeywords) {
        return {
          code: 'prompt_injection_attempt',
          title: 'Adversarial Prompt Injection Cue',
          explanation:
            'Submission contains adversarial instruction override syntax designed to manipulate AI analysis engines.',
          signal_type: 'deterministic_rule',
          evidence_refs: [],
        };
      }
      return null;
    },
  },
];

/**
 * Evaluates submitted text against the deterministic rule catalogue.
 */
export function evaluateDeterministicRules(text: string): RuleEvaluationResult {
  const lower = text.toLowerCase();
  const matchedReasons: ReasonItem[] = [];
  const actions: string[] = [];
  let hasHighSeverity = false;
  let hasMediumSeverity = false;

  for (const rule of DETERMINISTIC_SCAM_RULES) {
    const reason = rule.evaluate(text, lower);
    if (reason) {
      matchedReasons.push(reason);
      if (rule.recommendedAction && !actions.includes(rule.recommendedAction)) {
        actions.push(rule.recommendedAction);
      }
      if (rule.severity === 'high') {
        hasHighSeverity = true;
      } else {
        hasMediumSeverity = true;
      }
    }
  }

  let suggestedVerdict: ScamVerdict = 'no_obvious_risk_found';
  let suggestedRiskLevel: RiskLevel = 'low';

  if (hasHighSeverity) {
    suggestedVerdict = 'likely_scam';
    suggestedRiskLevel = 'high';
  } else if (hasMediumSeverity) {
    suggestedVerdict = 'suspicious';
    suggestedRiskLevel = 'medium';
  }

  // Always append standard cautionary action if scam patterns detected
  if (suggestedVerdict !== 'no_obvious_risk_found') {
    actions.push(
      'For suspected financial fraud in India, call the National Cyber Crime Helpline at 1930 or visit cybercrime.gov.in.'
    );
  }

  const limitations = [
    'Deterministic rule evaluation is pattern-based; absence of matched keywords does not prove authenticity.',
  ];

  return {
    matchedReasons,
    suggestedVerdict,
    suggestedRiskLevel,
    actions,
    limitations,
  };
}
