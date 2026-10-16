import { AnalysisType } from '../validation/schemas';

export interface ClaimExtractionResult {
  analysisType: AnalysisType;
  extractedClaim: string | null;
  hasFactualAssertion: boolean;
  hasScamRisk: boolean;
  searchQuery: string;
  claimKeywords: string[];
  explanation: string;
  isQuestionOnly: boolean;
  isInstructionOnly: boolean;
  isSubjectiveOpinion: boolean;
}

// Common spam / forward wrappers to strip for clean claim extraction
const VIRAL_PREFIX_REGEX = /^(?:forwarded as received[:\s!]+|breaking news[:\s!]+|urgent alert[:\s!]+|viral message[:\s!]+|important notice[:\s!]+|alert[:\s!]+|attention[:\s!]+|dekho[:\s!]+|suniye[:\s!]+|breaking[:\s!]+)/i;

// Conversational / greeting phrases
const GREETING_PHRASES = [
  'hi',
  'hello',
  'hey',
  'good morning',
  'good evening',
  'good afternoon',
  'namaste',
  'thanks',
  'thank you',
  'ok',
  'okay',
  'how are you',
  'kya haal hai',
  'kaisa hai',
  'test',
  'testing',
];

// Subjective opinion markers
const OPINION_MARKERS = [
  /in my opinion/i,
  /i think/i,
  /i feel like/i,
  /i believe that/i,
  /it seems to me/i,
  /my personal view/i,
  /mujhe lagta hai/i,
  /mere hisab se/i,
];

// Factual claim markers (government, policy, scheme, corporate, scientific, health, currency, law)
const FACTUAL_CLAIM_PATTERNS = [
  /(?:government|govt|pm modi|pradhan mantri|cabinet|parliament|rbi|supreme court|high court|who|isro|nasa|pib)\s+(?:has\s+)?(?:announced|ordered|banned|approved|launched|decided|declared|stated|ruled|passed|issued)/i,
  /(?:scheme|yojana|subsidy|grant|free laptop|free solar|free electricity|free smartphone|ration|pension)\s+(?:for all|announced|distribution|approved)/i,
  /(?:currency note|500 note|2000 note|demonetization|legal tender|banned from|discontinued from)/i,
  /(?:cures?|prevents?|treatment for)\s+(?:cancer|coronavirus|covid|diabetes|dengue|malaria|aids|hiv)/i,
  /(?:merged with|acquired by|bought by|shutting down|going bankrupt|closing down)/i,
  /(?:launched mission|moon landing|satellite|spacecraft|mars mission|isro)/i,
  /(?:sarkari yojana|pradhanmantri yojana|pib fact check|bijli bill mafi|loan mafi)/i,
];

// Scam / financial trap markers
const SCAM_RISK_PATTERNS = [
  /(?:upi pin|enter pin|scan qr|collect request|paytm|phonepe|gpay)\s+(?:to receive|to get|for refund)/i,
  /(?:otp|one time password|verification code)\s+(?:send|share|tell|forward|verify)/i,
  /(?:power will be cut|electricity.*disconnected tonight|sim.*blocked|account.*suspended|digital arrest)/i,
  /(?:download and install|install.*\.apk|download.*\.apk|anydesk|teamviewer|rustdesk)/i,
  /(?:registration fee|processing fee|security deposit|pay advance|transfer.*rs\b)/i,
  /(?:instant loan approved|loan sanction letter|disbursed without cibil)/i,
  /(?:lottery winner|kbc lottery|won prize|lucky draw)/i,
];

/**
 * Normalizes text and strips forwarding boilerplate
 */
export function cleanSubmissionText(rawText: string): string {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(VIRAL_PREFIX_REGEX, '').trim();
  return cleaned;
}

/**
 * Checks whether text is a pure question without any asserted factual proposition
 */
export function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.endsWith('?')) {
    // If it's a short question or question-word inquiry
    const startsWithQuestionWord = /^(?:is it true|is|are|was|were|will|can|could|would|who|what|where|when|why|how|kya|kaise|kab|kaha|kyun)\b/i.test(trimmed);
    return startsWithQuestionWord;
  }
  return false;
}

/**
 * Extracts key entity keywords from text for precision evidence queries
 */
export function extractClaimKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'from',
    'by', 'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
    'may', 'might', 'must', 'this', 'that', 'these', 'those', 'it', 'its', 'they',
    'their', 'all', 'any', 'please', 'kindly', 'now', 'today', 'tomorrow', 'yesterday',
    'click', 'link', 'share', 'forward', 'message', 'video', 'photo', 'news', 'update',
  ]);

  const words = text
    .replace(/[^\w\s\u0900-\u097F-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return Array.from(new Set(words)).slice(0, 8);
}

/**
 * Primary analyzer: Identifies whether the input contains scam risk, factual claim, both, or insufficient info,
 * and extracts the candidate claim statement.
 */
export function identifyAnalysisTypeAndClaim(text: string): ClaimExtractionResult {
  const cleaned = cleanSubmissionText(text);
  const lower = cleaned.toLowerCase();

  // 1. Check for Insufficient Information / Pure Conversational Greetings
  if (cleaned.length < 8) {
    return {
      analysisType: 'insufficient_information',
      extractedClaim: null,
      hasFactualAssertion: false,
      hasScamRisk: false,
      searchQuery: '',
      claimKeywords: [],
      explanation: 'Submission is too short or lacks context for evaluation.',
      isQuestionOnly: false,
      isInstructionOnly: false,
      isSubjectiveOpinion: false,
    };
  }

  const cleanedGreeting = lower.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const isGreetingOnly = GREETING_PHRASES.some(
    (g) => cleanedGreeting === g || (cleanedGreeting.startsWith(g) && cleanedGreeting.length < 50)
  ) && !FACTUAL_CLAIM_PATTERNS.some((re) => re.test(lower)) && !SCAM_RISK_PATTERNS.some((re) => re.test(lower));

  if (isGreetingOnly) {
    return {
      analysisType: 'insufficient_information',
      extractedClaim: null,
      hasFactualAssertion: false,
      hasScamRisk: false,
      searchQuery: '',
      claimKeywords: [],
      explanation: 'Submission contains conversational greetings or pleasantries with no verifiable claims or scam threats.',
      isQuestionOnly: false,
      isInstructionOnly: false,
      isSubjectiveOpinion: false,
    };
  }

  // 2. Check for Pure Subjective Opinion
  const isSubjective = OPINION_MARKERS.some((re) => re.test(lower)) &&
    !FACTUAL_CLAIM_PATTERNS.some((re) => re.test(lower)) &&
    !SCAM_RISK_PATTERNS.some((re) => re.test(lower));

  if (isSubjective) {
    return {
      analysisType: 'insufficient_information',
      extractedClaim: null,
      hasFactualAssertion: false,
      hasScamRisk: false,
      searchQuery: '',
      claimKeywords: [],
      explanation: 'Submission expresses a subjective opinion or personal belief rather than an empirical factual claim.',
      isQuestionOnly: false,
      isInstructionOnly: false,
      isSubjectiveOpinion: true,
    };
  }

  // 3. Check for Scam / Security Risk Markers
  const hasScam = SCAM_RISK_PATTERNS.some((re) => re.test(lower));

  // 4. Check for Factual Claim Markers
  const hasExplicitFactualClaim = FACTUAL_CLAIM_PATTERNS.some((re) => re.test(lower));

  // 5. Check if it's an imperative instruction without a factual claim
  const isInstruction = /^(?:please\s+)?(?:click|download|install|pay|transfer|send|forward|call|dial|share)\b/i.test(cleaned) &&
    !hasExplicitFactualClaim;

  // 6. Check if it's a question
  const isQ = isQuestion(cleaned);

  // Determine Analysis Type
  let analysisType: AnalysisType = 'insufficient_information';
  let extractedClaim: string | null = null;
  let explanation = '';

  if (hasScam && hasExplicitFactualClaim) {
    analysisType = 'both';
    explanation = 'Submission combines a verifiable factual assertion with high-risk scam or financial solicitation triggers.';
  } else if (hasScam) {
    analysisType = 'scam_risk';
    explanation = 'Submission exhibits direct scam, extortion, or credential solicitation patterns without a broader factual policy claim.';
  } else if (hasExplicitFactualClaim) {
    analysisType = 'factual_claim';
    explanation = 'Submission asserts a verifiable factual claim regarding public policy, government action, science, or institutions.';
  } else if (isInstruction) {
    analysisType = 'scam_risk';
    explanation = 'Submission contains imperative instructions or action solicitations rather than verifiable factual claims.';
  } else if (isQ) {
    analysisType = 'factual_claim';
    explanation = 'User is inquiring about the veracity of a specific topic or factual claim.';
  } else {
    // Check if the sentence has a subject-verb predicate structure typical of statements
    const words = cleaned.split(/\s+/);
    if (words.length >= 6) {
      // Treat as potential factual claim if substantial text without obvious scam triggers
      analysisType = 'factual_claim';
      explanation = 'Text presents declarative statements that can be checked against independent reference sources.';
    } else {
      analysisType = 'insufficient_information';
      explanation = 'Submission lacks sufficient factual context or verifiable propositions.';
    }
  }

  // Extract the claim if an assertion exists
  if (analysisType === 'factual_claim' || analysisType === 'both') {
    // If it's a multi-sentence text, extract the sentence asserting the fact
    const sentences = cleaned.split(/(?<=[.?!।])\s+/).filter((s) => s.trim().length > 0);
    const claimSentence =
      sentences.find((s) => FACTUAL_CLAIM_PATTERNS.some((re) => re.test(s))) ||
      sentences[0] ||
      cleaned;

    extractedClaim = claimSentence.trim().slice(0, 250);
  }

  const keywords = extractedClaim ? extractClaimKeywords(extractedClaim) : extractClaimKeywords(cleaned);
  const searchQuery = keywords.slice(0, 5).join(' ');

  return {
    analysisType,
    extractedClaim,
    hasFactualAssertion: analysisType === 'factual_claim' || analysisType === 'both',
    hasScamRisk: analysisType === 'scam_risk' || analysisType === 'both',
    searchQuery: searchQuery || cleaned.slice(0, 100),
    claimKeywords: keywords,
    explanation,
    isQuestionOnly: isQ && !hasExplicitFactualClaim,
    isInstructionOnly: isInstruction,
    isSubjectiveOpinion: false,
  };
}
