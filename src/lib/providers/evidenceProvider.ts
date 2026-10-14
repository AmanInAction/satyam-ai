import {
  IEvidenceProvider,
  EvidenceSearchResult,
} from './interfaces';
import { EvidenceItem, ProviderStatus } from '../validation/schemas';

export interface EvidenceProviderConfig {
  timeoutMs?: number;
  factCheckApiKey?: string;
}

/**
 * Real live encyclopedic evidence retrieval provider using Wikipedia's Search API.
 * Provides attributable, traceable citations with title, publisher, and verified canonical URL.
 */
export class WikipediaEvidenceProvider implements IEvidenceProvider {
  name = 'wikipedia_knowledge';
  private timeoutMs: number;

  constructor(timeoutMs: number = 5000) {
    this.timeoutMs = timeoutMs;
  }

  async searchEvidence(query: string): Promise<EvidenceSearchResult> {
    const cleanedQuery = query.trim().slice(0, 150);
    if (!cleanedQuery || cleanedQuery.length < 3) {
      return {
        evidence: [],
        status: 'success',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        cleanedQuery
      )}&format=json&utf8=1&srlimit=3`;

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SatyamAI-EvidenceBot/1.0 (https://satyam-ai.org; contact@satyam-ai.org)',
          Accept: 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          evidence: [],
          status: 'unavailable',
        };
      }

      const data = await response.json();
      const searchResults = data?.query?.search;

      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        return {
          evidence: [],
          status: 'success',
        };
      }

      const evidence: EvidenceItem[] = searchResults.map((item: any) => {
        const title = item.title || 'Wikipedia Reference';
        const rawSnippet = item.snippet || '';
        const cleanSnippet = rawSnippet.replace(/<[^>]+>/g, '').trim();
        const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
          title.replace(/\s+/g, '_')
        )}`;

        return {
          title,
          publisher: 'Wikipedia, The Free Encyclopedia',
          url: articleUrl,
          relevance: cleanSnippet || `Encyclopedic reference related to "${title}".`,
          source_type: 'encyclopedic_reference',
        };
      });

      return {
        evidence,
        status: 'success',
      };
    } catch {
      clearTimeout(timeout);
      return {
        evidence: [],
        status: 'unavailable',
      };
    }
  }
}

/**
 * Google Fact Check Tools API adapter.
 * Uses claims:search endpoint when API credentials are provided.
 */
export class GoogleFactCheckProvider implements IEvidenceProvider {
  name = 'google_fact_check';
  private apiKey: string | null;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs: number = 5000) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_FACT_CHECK_API_KEY ||
      process.env.FACT_CHECK_API_KEY ||
      null;
    this.timeoutMs = timeoutMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async searchEvidence(query: string): Promise<EvidenceSearchResult> {
    if (!this.isConfigured() || !this.apiKey) {
      return {
        evidence: [],
        status: 'not_configured',
      };
    }

    const cleanedQuery = query.trim().slice(0, 150);
    if (!cleanedQuery) {
      return {
        evidence: [],
        status: 'success',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(
        cleanedQuery
      )}&key=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          evidence: [],
          status: 'unavailable',
        };
      }

      const data = await response.json();
      const claims = data?.claims;

      if (!Array.isArray(claims) || claims.length === 0) {
        return {
          evidence: [],
          status: 'success',
        };
      }

      const evidence: EvidenceItem[] = [];
      for (const claim of claims.slice(0, 3)) {
        const review = claim.claimReview?.[0];
        if (review) {
          const publisherName = review.publisher?.name || 'Independent Fact-Checker';
          const reviewUrl = review.url;
          const rating = review.textualRating || 'Unrated';
          const claimText = claim.text || 'Claim';

          if (reviewUrl) {
            evidence.push({
              title: `${publisherName}: "${rating}" on "${claimText.slice(0, 80)}"`,
              publisher: publisherName,
              url: reviewUrl,
              relevance: `Fact-check evaluation rated claim as: ${rating}`,
              source_type: 'fact_check_organization',
            });
          }
        }
      }

      return {
        evidence,
        status: 'success',
      };
    } catch {
      clearTimeout(timeout);
      return {
        evidence: [],
        status: 'failed',
      };
    }
  }
}

/**
 * Composite Evidence Provider
 * Queries authoritative fact-check databases if configured, complemented by Wikipedia knowledge search.
 */
export class CompositeEvidenceProvider implements IEvidenceProvider {
  name = 'composite_evidence';
  private factCheck: GoogleFactCheckProvider;
  private wiki: WikipediaEvidenceProvider;

  constructor(config: EvidenceProviderConfig = {}) {
    this.factCheck = new GoogleFactCheckProvider(config.factCheckApiKey, config.timeoutMs);
    this.wiki = new WikipediaEvidenceProvider(config.timeoutMs);
  }

  async searchEvidence(query: string): Promise<EvidenceSearchResult> {
    const combinedEvidence: EvidenceItem[] = [];
    let overallStatus: ProviderStatus = 'not_configured';

    // 1. Try Google Fact Check Tools if configured
    if (this.factCheck.isConfigured()) {
      try {
        const fcResult = await this.factCheck.searchEvidence(query);
        if (fcResult.status === 'success' && fcResult.evidence.length > 0) {
          combinedEvidence.push(...fcResult.evidence);
          overallStatus = 'success';
        } else if (fcResult.status === 'success') {
          overallStatus = 'success';
        } else {
          overallStatus = fcResult.status;
        }
      } catch {
        overallStatus = 'unavailable';
      }
    }

    // 2. Query Wikipedia encyclopedic database
    try {
      const wikiResult = await this.wiki.searchEvidence(query);
      if (wikiResult.status === 'success' && wikiResult.evidence.length > 0) {
        // Append distinct results
        for (const item of wikiResult.evidence) {
          if (!combinedEvidence.some((e) => e.url === item.url)) {
            combinedEvidence.push(item);
          }
        }
        overallStatus = 'success';
      } else if (overallStatus === 'not_configured') {
        overallStatus = wikiResult.status;
      }
    } catch {
      if (overallStatus === 'not_configured') {
        overallStatus = 'unavailable';
      }
    }

    return {
      evidence: combinedEvidence,
      status: overallStatus,
    };
  }
}
