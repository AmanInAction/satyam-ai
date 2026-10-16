import { EvidenceItem, ClaimVerdict, VerificationSource } from '../validation/schemas';
import { extractClaimKeywords } from './claimExtractor';

export interface EvaluatedClaimResult {
  verdict: ClaimVerdict;
  explanation: string;
  verificationSource: VerificationSource;
  relevantEvidence: EvidenceItem[];
  filteredOutCount: number;
}

const KNOWN_FACT_CHECK_PUBLISHERS = [
  'pib fact check',
  'alt news',
  'boom',
  'boom live',
  'vishwas news',
  'the quint webqoof',
  'indiatoday anti fake news war room',
  'afp fact check',
  'reuters fact check',
  'factchecker.in',
  'snopes',
  'full fact',
];

const DEBUNK_MARKERS = [
  /\bfalse\b/i,
  /\bfake\b/i,
  /\bhoax\b/i,
  /\bdebunk(?:ed)?\b/i,
  /\bmisleading\b/i,
  /\bno evidence\b/i,
  /\bfalsely claimed\b/i,
  /\brefutes?\b/i,
  /\bdenies\b/i,
  /\bnot true\b/i,
  /\brumor\b/i,
  /\brumour\b/i,
  /\bwarning issued\b/i,
  /\bfact check: false\b/i,
  /\bcaution: scam\b/i,
];

const AFFIRM_MARKERS = [
  /\bofficially confirmed\b/i,
  /\bconfirmed by\b/i,
  /\blaunched officially\b/i,
  /\bpassed into law\b/i,
  /\bestablished (?:fact|record)\b/i,
  /\bverified scheme\b/i,
  /\bofficial release\b/i,
];

/**
 * Computes a normalized relevance score between an evidence item and the target subject/claim.
 * Returns a value between 0.0 (completely irrelevant) and 1.0 (highly relevant).
 */
export function computeEvidenceRelevance(
  item: EvidenceItem,
  targetSubject: string,
  claim: string | null
): number {
  const combinedText = `${item.title} ${item.relevance} ${item.url}`.toLowerCase();
  const targetKeywords = extractClaimKeywords(`${targetSubject} ${claim || ''}`);

  if (targetKeywords.length === 0) return 0.5;

  let matchCount = 0;
  for (const kw of targetKeywords) {
    if (combinedText.includes(kw)) {
      matchCount += 1;
    }
  }

  const ratio = matchCount / targetKeywords.length;

  // Title match is weighted higher
  const titleLower = item.title.toLowerCase();
  const hasTitleMatch = targetKeywords.some((kw) => titleLower.includes(kw));
  const score = hasTitleMatch ? Math.min(1.0, ratio * 0.7 + 0.3) : ratio * 0.7;

  return Math.round(score * 100) / 100;
}

/**
 * Filter out candidate evidence that does not meet minimum relevance thresholds,
 * preventing unrelated articles (e.g. airline codes for banking URLs) from appearing as citations.
 */
export function filterAndScoreEvidence(
  candidates: EvidenceItem[],
  targetSubject: string,
  claim: string | null,
  minRelevanceThreshold: number = 0.20
): { relevant: EvidenceItem[]; filteredOutCount: number } {
  let filteredOutCount = 0;
  const relevant: EvidenceItem[] = [];

  for (const candidate of candidates) {
    const score = candidate.relevance_score ?? computeEvidenceRelevance(candidate, targetSubject, claim);

    // If score is below threshold, filter out as irrelevant
    if (score < minRelevanceThreshold) {
      filteredOutCount += 1;
      continue;
    }

    // Determine publisher category and finding
    let sourceType = candidate.source_type || 'reference';
    const publisherLower = (candidate.publisher || '').toLowerCase();

    if (KNOWN_FACT_CHECK_PUBLISHERS.some((p) => publisherLower.includes(p))) {
      sourceType = 'fact_check_organization';
    } else if (publisherLower.includes('wikipedia') || publisherLower.includes('wikimedia')) {
      sourceType = 'encyclopedic_reference';
    } else if (publisherLower.includes('gov.in') || publisherLower.includes('nic.in') || publisherLower.includes('official')) {
      sourceType = 'official_portal';
    }

    const snippetLower = `${candidate.title} ${candidate.relevance}`.toLowerCase();
    const hasDebunk = DEBUNK_MARKERS.some((re) => re.test(snippetLower));
    const hasAffirm = AFFIRM_MARKERS.some((re) => re.test(snippetLower));

    let finding: 'supports' | 'contradicts' | 'neutral' | 'unrelated' = 'neutral';
    if (hasDebunk && !hasAffirm) {
      finding = 'contradicts';
    } else if (hasAffirm && !hasDebunk) {
      finding = 'supports';
    }

    relevant.push({
      ...candidate,
      source_type: sourceType,
      relevance_score: score,
      verification_finding: candidate.verification_finding || finding,
    });
  }

  return { relevant, filteredOutCount };
}

/**
 * Evaluates the factual claim against attributable evidence items using strict verdict discipline.
 * Never asserts certainty without direct justification from evidence.
 */
export function evaluateClaimFromEvidence(
  extractedClaim: string | null,
  evidence: EvidenceItem[],
  isFactualClaim: boolean
): EvaluatedClaimResult {
  if (!isFactualClaim || !extractedClaim) {
    return {
      verdict: 'unverified',
      explanation: 'No verifiable factual assertion detected in submission.',
      verificationSource: 'unverified',
      relevantEvidence: [],
      filteredOutCount: 0,
    };
  }

  const { relevant, filteredOutCount } = filterAndScoreEvidence(evidence, extractedClaim, extractedClaim);

  if (relevant.length === 0) {
    return {
      verdict: 'unverified',
      explanation:
        'No verifiable reference or fact-check sources were found for this specific claim. Absence of evidence does not imply that the claim is true or safe.',
      verificationSource: 'unverified',
      relevantEvidence: [],
      filteredOutCount,
    };
  }

  let contradictsCount = 0;
  let supportsCount = 0;
  let hasFactCheckOrg = false;

  for (const item of relevant) {
    if (item.source_type === 'fact_check_organization') {
      hasFactCheckOrg = true;
    }
    if (item.verification_finding === 'contradicts') {
      contradictsCount += 1;
    } else if (item.verification_finding === 'supports') {
      supportsCount += 1;
    }
  }

  let verdict: ClaimVerdict = 'unverified';
  let explanation = '';
  let verificationSource: VerificationSource = 'evidence_limited_inference';

  if (contradictsCount > 0 && supportsCount === 0) {
    verdict = 'contradicted';
    verificationSource = hasFactCheckOrg ? 'fact_check_database' : 'encyclopedic_reference';
    explanation =
      'Independent reference sources and fact-check records contradict or refute this claim.';
  } else if (supportsCount > 0 && contradictsCount === 0) {
    verdict = 'supported';
    verificationSource = hasFactCheckOrg ? 'fact_check_database' : 'encyclopedic_reference';
    explanation =
      'Attributable reference sources corroborate the factual assertion.';
  } else if (supportsCount > 0 && contradictsCount > 0) {
    verdict = 'mixed';
    verificationSource = 'fact_check_database';
    explanation =
      'Available evidence presents conflicting or disputed accounts regarding this claim.';
  } else {
    verdict = 'unverified';
    verificationSource = 'evidence_limited_inference';
    explanation =
      'Retrieved reference sources provide context regarding the subject, but do not conclusively verify or refute the specific claim proposition.';
  }

  return {
    verdict,
    explanation,
    verificationSource,
    relevantEvidence: relevant,
    filteredOutCount,
  };
}
