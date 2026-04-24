import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../constants/constants.service';
import { LoggerService } from '../logger.service';
import { ApiService } from '../api/api.service';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

@Injectable()
export class TavilyService {
  private readonly apiKey: string;

  constructor(
    private readonly constantsService: ConstantsService,
    private readonly loggerService: LoggerService,
    private readonly apiService: ApiService,
  ) {
    this.apiKey = this.constantsService.private.TAVILY_API_KEY;
  }

  private async callApi(body: Record<string, unknown>): Promise<any> {
    const response = await this.apiService.request({
      method: 'POST',
      url: this.constantsService.private.TAVILY_BASE_URL,
      data: { api_key: this.apiKey, ...body },
    });
    return response.data;
  }

  async search(query: string, searchDepth: 'basic' | 'advanced' = 'basic', maxResults = 5): Promise<TavilySearchResult[]> {
    if (!this.apiKey) return [];
    try {
      const data = await this.callApi({
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_images: false,
        include_answer: false,
        include_raw_content: false,
      });
      return data.results || [];
    } catch (error) {
      this.loggerService.error({ error });
      return [];
    }
  }

  async crawlWebsite(url: string): Promise<string> {
    const results = await this.search(`site:${url} hotel information hours wifi policy`, 'advanced', 10);
    let text = '';
    for (let i = 0; i < results.length; i++) {
      if (text) text += '\n\n';
      text += `--- SOURCE: ${results[i].url} ---\n${results[i].content}`;
    }
    return text;
  }

  async fetchRawHtml(url: string): Promise<string> {
    if (!this.apiKey) return '';
    try {
      const data = await this.callApi({
        query: url,
        search_depth: 'basic',
        max_results: 1,
        include_images: false,
        include_answer: false,
        include_raw_content: true,
      });
      const results = data.results || [];
      return results[0]?.raw_content || '';
    } catch (error) {
      this.loggerService.error({ error });
      return '';
    }
  }
}
