import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConstantsService } from '../constants/constants.service';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

@Injectable()
export class TavilyService {
  private readonly baseUrl = 'https://api.tavily.com/search';
  private readonly apiKey: string;

  constructor(private readonly constantsService: ConstantsService) {
    this.apiKey = this.constantsService.private.TAVILY_API_KEY;
  }

  async search(query: string, searchDepth: 'basic' | 'advanced' = 'basic', maxResults: number = 5): Promise<TavilySearchResult[]> {
    if (!this.apiKey) return [];

    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_images: false,
        include_answer: false,
        include_raw_content: false,
      });

      return response.data.results || [];
    } catch (error) {
      console.error('Tavily Search Error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Specifically crawls a website by searching for the URL directly or highly relevant terms.
   */
  async crawlWebsite(url: string): Promise<string> {
    const results = await this.search(`site:${url} hotel information hours wifi policy`, 'advanced', 10);
    return results.map(r => `--- SOURCE: ${r.url} ---\n${r.content}`).join('\n\n');
  }

  async fetchRawHtml(url: string): Promise<string> {
    if (!this.apiKey) return '';
    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: url,
        search_depth: 'basic',
        max_results: 1,
        include_images: false,
        include_answer: false,
        include_raw_content: true,
      });
      const results = response.data.results || [];
      return results[0]?.raw_content || '';
    } catch (error) {
      console.error('Tavily Raw Fetch Error:', error.response?.data || error.message);
      return '';
    }
  }
}
