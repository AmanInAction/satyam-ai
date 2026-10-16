import { describe, it, expect } from 'vitest';
import {
  identifyAnalysisTypeAndClaim,
  extractClaimKeywords,
  isQuestion,
  cleanSubmissionText,
} from '../src/lib/analysis/claimExtractor';
import {
  computeEvidenceRelevance,
  filterAndScoreEvidence,
  evaluateClaimFromEvidence,
} from '../src/lib/analysis/evidenceEvaluator';
import { AnalysisOrchestrator } from '../src/lib/analysis/orchestrator';
import { IEvidenceProvider, EvidenceSearchResult } from '../src/lib/providers/interfaces';
import { EvidenceItem } from '../src/lib/validation/schemas';

describe('Phase 4: Unified Scam + Misinformation Assessment', () => {
  describe('Priority 1 & 2: Analysis-Type Identification & Claim Extraction', () => {
    it('identifies pure scam messages as scam_risk without fabricating a factual claim', () => {
      const text = 'Dear consumer, your electricity power will be cut tonight at 9:30 PM. Call electricity officer at 9876543210 immediately.';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('scam_risk');
      expect(res.hasScamRisk).toBe(true);
      expect(res.hasFactualAssertion).toBe(false);
      expect(res.extractedClaim).toBeNull();
    });

    it('identifies public policy/currency announcement as factual_claim and extracts proposition', () => {
      const text = 'Forwarded as received: RBI has announced that 500 rupee currency notes will be completely banned from December 2026.';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('factual_claim');
      expect(res.hasFactualAssertion).toBe(true);
      expect(res.hasScamRisk).toBe(false);
      expect(res.extractedClaim).toContain('500 rupee currency notes');
      expect(res.claimKeywords).toContain('rbi');
    });

    it('identifies dual threats (scam trap combined with fake government scheme lure) as both', () => {
      const text = 'Government has announced free solar panels under PM Kusum Yojana for all citizens. Pay Rs 200 registration fee via UPI to claim at bit.ly/free-solar.';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('both');
      expect(res.hasScamRisk).toBe(true);
      expect(res.hasFactualAssertion).toBe(true);
      expect(res.extractedClaim).toBeTruthy();
    });

    it('identifies conversational greetings and short chatter as insufficient_information', () => {
      const text = 'Hello, good morning! How are you?';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('insufficient_information');
      expect(res.hasFactualAssertion).toBe(false);
      expect(res.extractedClaim).toBeNull();
    });

    it('refuses to treat subjective opinions as verifiable factual claims', () => {
      const text = 'In my opinion cricket is the most exciting sport in the world and I feel everyone should play it.';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('insufficient_information');
      expect(res.isSubjectiveOpinion).toBe(true);
      expect(res.extractedClaim).toBeNull();
    });

    it('refuses to treat pure imperative instructions as verifiable claims', () => {
      const text = 'Please click here to download and install this file right now.';
      const res = identifyAnalysisTypeAndClaim(text);

      expect(res.analysisType).toBe('scam_risk');
      expect(res.hasFactualAssertion).toBe(false);
      expect(res.extractedClaim).toBeNull();
    });

    it('extracts precision search keywords while omitting common stop words and spam boilerplate', () => {
      const text = 'Alert! Government announced free laptop distribution for all college students under Yuva scheme.';
      const cleaned = cleanSubmissionText(text);
      expect(cleaned.startsWith('Alert!')).toBe(false);

      const keywords = extractClaimKeywords(cleaned);
      expect(keywords).toContain('government');
      expect(keywords).toContain('laptop');
      expect(keywords).toContain('students');
      expect(keywords).not.toContain('for');
      expect(keywords).not.toContain('all');
    });
  });

  describe('Priority 3 & 5: Evidence Relevance Scoring & Quality Filtering', () => {
    it('discards completely irrelevant articles from citations (e.g. airline codes for banking context)', () => {
      const candidates: EvidenceItem[] = [
        {
          title: 'List of airline codes',
          publisher: 'Wikipedia, The Free Encyclopedia',
          url: 'https://en.wikipedia.org/wiki/List_of_airline_codes',
          relevance: 'SOLOFLIGHT AVIATION LIMITED overview - Find company information',
        },
      ];

      const { relevant, filteredOutCount } = filterAndScoreEvidence(
        candidates,
        'sbi-kyc-update.xyz',
        null,
        0.20
      );

      expect(relevant.length).toBe(0);
      expect(filteredOutCount).toBe(1);
    });

    it('retains and scores highly relevant institutional citations', () => {
      const candidates: EvidenceItem[] = [
        {
          title: 'State Bank of India',
          publisher: 'Wikipedia, The Free Encyclopedia',
          url: 'https://en.wikipedia.org/wiki/State_Bank_of_India',
          relevance: 'State Bank of India (SBI) is an Indian multinational public sector bank and financial services statutory body.',
        },
      ];

      const { relevant, filteredOutCount } = filterAndScoreEvidence(
        candidates,
        'State Bank of India sbi',
        null,
        0.20
      );

      expect(relevant.length).toBe(1);
      expect(filteredOutCount).toBe(0);
      expect(relevant[0].relevance_score).toBeGreaterThan(0.4);
      expect(relevant[0].source_type).toBe('encyclopedic_reference');
    });
  });

  describe('Priority 4: Grounded Verdict Discipline (supported, contradicted, mixed, unverified)', () => {
    it('marks claim as contradicted when attributable fact-checks debunk the claim', () => {
      const evidence: EvidenceItem[] = [
        {
          title: 'Fact Check: RBI has NOT banned Rs 500 notes',
          publisher: 'PIB Fact Check',
          url: 'https://factcheck.pib.gov.in/rbi-500-note-rumor',
          relevance: 'PIB Fact Check confirmed that viral messages claiming demonetization of 500 rupee notes are completely false and misleading.',
        },
      ];

      const res = evaluateClaimFromEvidence('RBI banned 500 note', evidence, true);

      expect(res.verdict).toBe('contradicted');
      expect(res.verificationSource).toBe('fact_check_database');
      expect(res.relevantEvidence.length).toBe(1);
      expect(res.relevantEvidence[0].verification_finding).toBe('contradicts');
    });

    it('marks claim as supported when official encyclopedic records corroborate the statement', () => {
      const evidence: EvidenceItem[] = [
        {
          title: 'Chandrayaan-3',
          publisher: 'Wikipedia, The Free Encyclopedia',
          url: 'https://en.wikipedia.org/wiki/Chandrayaan-3',
          relevance: 'Chandrayaan-3 successfully landed near the lunar south pole on 23 August 2023, confirmed by ISRO.',
        },
      ];

      const res = evaluateClaimFromEvidence('ISRO launched and landed Chandrayaan-3', evidence, true);

      expect(res.verdict).toBe('supported');
      expect(res.verificationSource).toBe('encyclopedic_reference');
      expect(res.relevantEvidence[0].verification_finding).toBe('supports');
    });

    it('marks claim as mixed when sources present conflicting findings', () => {
      const evidence: EvidenceItem[] = [
        {
          title: 'Scheme Report: Disputed rollout dates',
          publisher: 'Boom Live',
          url: 'https://boomlive.in/fact-check-scheme',
          relevance: 'While the subsidy scheme was officially confirmed, the viral claim that payments are universal is false.',
        },
      ];

      // Item with both affirm and debunk cues or multiple items
      const multiEvidence: EvidenceItem[] = [
        {
          title: 'Ministry confirms launch of government subsidy pilot',
          publisher: 'PIB Fact Check',
          url: 'https://factcheck.pib.gov.in/scheme-pilot',
          relevance: 'Officially confirmed subsidy pilot rollout in selected districts.',
          verification_finding: 'supports',
        },
        {
          title: 'Fact Check: Claim of free nationwide payout is false',
          publisher: 'Alt News',
          url: 'https://altnews.in/scheme-rumor',
          relevance: 'Viral message claiming universal transfer is false and fake.',
          verification_finding: 'contradicts',
        },
      ];

      const res = evaluateClaimFromEvidence('Free government subsidy rollout', multiEvidence, true);

      expect(res.verdict).toBe('mixed');
      expect(res.verificationSource).toBe('fact_check_database');
    });

    it('returns unverified with transparent disclosure when no relevant evidence is found', () => {
      const res = evaluateClaimFromEvidence('Obscure claim about unknown entity', [], true);

      expect(res.verdict).toBe('unverified');
      expect(res.verificationSource).toBe('unverified');
      expect(res.explanation).toContain('Absence of evidence does not imply');
    });
  });

  describe('Integration: Orchestrator Dual Assessment End-to-End', () => {
    it('never collapses scam risk and claim accuracy into a single ambiguous verdict', async () => {
      // Mock evidence provider returning a debunking article
      const mockEvidence: IEvidenceProvider = {
        name: 'test_evidence_provider',
        async searchEvidence(query: string): Promise<EvidenceSearchResult> {
          if (query.toLowerCase().includes('laptop') || query.toLowerCase().includes('yuva')) {
            return {
              status: 'success',
              evidence: [
                {
                  title: 'Fact Check: Government is NOT giving free laptops under Yuva Scheme',
                  publisher: 'PIB Fact Check',
                  url: 'https://factcheck.pib.gov.in/free-laptop-scam',
                  relevance: 'PIB Fact Check warns that messages promising free laptops are fake and a front for UPI fee fraud.',
                  source_type: 'fact_check_organization',
                },
              ],
            };
          }
          return { status: 'success', evidence: [] };
        },
      };

      const orchestrator = new AnalysisOrchestrator({ evidenceProvider: mockEvidence });

      const text = 'Government has announced free laptops under PM Yuva Scheme for all students. Pay Rs 200 registration fee via UPI to claim immediately.';
      const res = await orchestrator.analyzeText(text);

      expect(res.classification.analysis_type).toBe('both');
      // Dimension 1: Scam risk must be high / likely_scam
      expect(res.classification.scam_risk.verdict).toBe('likely_scam');
      expect(res.classification.scam_risk.risk_level).toBe('high');

      // Dimension 2: Claim verification must be contradicted based on evidence
      expect(res.classification.claim_verification.verdict).toBe('contradicted');
      expect(res.classification.claim_verification.extracted_claim).toBeTruthy();
      expect(res.classification.claim_verification.verification_source).toBe('fact_check_database');

      // Summary explains both
      expect(res.summary).toContain('Dual threat');
      expect(res.evidence.length).toBe(1);
      expect(res.evidence[0].publisher).toBe('PIB Fact Check');
    });

    it('handles evidence provider outage without fabricating evidence or implying safety', async () => {
      const failingEvidence: IEvidenceProvider = {
        name: 'failing_provider',
        async searchEvidence(): Promise<EvidenceSearchResult> {
          throw new Error('Network timeout during search');
        },
      };

      const orchestrator = new AnalysisOrchestrator({ evidenceProvider: failingEvidence });

      const text = 'RBI announced that 500 rupee notes are banned from next month.';
      const res = await orchestrator.analyzeText(text);

      expect(res.provider_status.evidence).toBe('unavailable');
      expect(res.classification.claim_verification.verdict).toBe('unverified');
      expect(res.evidence.length).toBe(0);
      expect(res.limitations.some((l) => l.includes('evidence'))).toBe(true);
    });
  });
});
