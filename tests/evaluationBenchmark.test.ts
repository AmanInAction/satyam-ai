import { describe, it, expect } from 'vitest';
import { AnalysisOrchestrator } from '../src/lib/analysis/orchestrator';
import { EVALUATION_BENCHMARK_DATASET, EvaluationScenario } from '../src/lib/evaluation/evaluationDataset';

describe('Phase 7: Versioned 18-Scenario Release Candidate Benchmark', () => {
  const orchestrator = new AnalysisOrchestrator();

  EVALUATION_BENCHMARK_DATASET.forEach((scenario: EvaluationScenario) => {
    it(`[#${scenario.id}] ${scenario.name} (${scenario.category})`, async () => {
      let response: any;

      if (scenario.inputType === 'text' && scenario.textInput) {
        response = await orchestrator.analyzeText(scenario.textInput, scenario.language);
      } else if (scenario.inputType === 'url' && scenario.urlInput) {
        response = await orchestrator.analyzeUrl(scenario.urlInput);
      } else if (scenario.inputType === 'image' && scenario.imageInputGenerator) {
        const { buffer, mimeType } = scenario.imageInputGenerator();
        response = await orchestrator.analyzeImage(buffer, mimeType, scenario.language);
      } else {
        throw new Error(`Incomplete scenario configuration for #${scenario.id}`);
      }

      // Basic schema compliance
      expect(response).toBeDefined();
      expect(response.analysis_id).toBeTruthy();
      expect(response.classification).toBeDefined();
      expect(response.classification.scam_risk).toBeDefined();
      expect(response.classification.claim_verification).toBeDefined();

      // Scenario-specific pass/fail evaluation
      const evalResult = scenario.evaluatePass(response);
      expect(
        evalResult.passed,
        `Scenario #${scenario.id} failed: ${evalResult.message}. Criteria: ${scenario.passFailCriteria}`
      ).toBe(true);
    });
  });

  describe('Aggregate Benchmark Release Gates', () => {
    it('verifies 100% false-positive discipline on benign samples (Scenarios 3 & 5)', async () => {
      const benignText = EVALUATION_BENCHMARK_DATASET.find((s) => s.id === 3)!;
      const benignUrl = EVALUATION_BENCHMARK_DATASET.find((s) => s.id === 5)!;

      const resText = await orchestrator.analyzeText(benignText.textInput!);
      const resUrl = await orchestrator.analyzeUrl(benignUrl.urlInput!);

      expect(resText.classification.scam_risk.verdict).toBe('no_obvious_risk_found');
      expect(resText.classification.scam_risk.risk_level).toBe('low');

      expect(resUrl.classification.scam_risk.verdict).toBe('no_obvious_risk_found');
      expect(resUrl.classification.scam_risk.risk_level).toBe('low');
    });

    it('verifies 100% false-negative protection on critical scams (Scenarios 1, 2, 6, 11, 15)', async () => {
      const highRiskIds = [1, 2, 6, 11, 15];
      for (const id of highRiskIds) {
        const scenario = EVALUATION_BENCHMARK_DATASET.find((s) => s.id === id)!;
        let res: any;
        if (scenario.inputType === 'text') {
          res = await orchestrator.analyzeText(scenario.textInput!, scenario.language);
        } else if (scenario.inputType === 'url') {
          res = await orchestrator.analyzeUrl(scenario.urlInput!);
        }

        expect(
          res.classification.scam_risk.verdict,
          `High risk scenario #${id} was missed!`
        ).not.toBe('no_obvious_risk_found');
      }
    });

    it('verifies uncertainty discipline on ambiguous and absent evidence (Scenarios 4, 10, 18)', async () => {
      const uncertainIds = [4, 10, 18];
      for (const id of uncertainIds) {
        const scenario = EVALUATION_BENCHMARK_DATASET.find((s) => s.id === id)!;
        let res: any;
        if (scenario.inputType === 'text') {
          res = await orchestrator.analyzeText(scenario.textInput!, scenario.language);
        } else if (scenario.inputType === 'image') {
          const { buffer, mimeType } = scenario.imageInputGenerator!();
          res = await orchestrator.analyzeImage(buffer, mimeType, scenario.language);
        }

        // Must never assert false certainty or claim truth without evidence
        expect(res.classification.claim_verification.verdict).toBe('unverified');
      }
    });
  });
});
