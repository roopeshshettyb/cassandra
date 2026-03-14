import { Injectable } from '@nestjs/common';
import { LangGraphService, ExtractedBookingFields } from '../langgraph/langgraph.service';

@Injectable()
export class DocumentExtractionService {
  constructor(private readonly langGraphService: LangGraphService) {}

  /**
   * Extract booking fields from a document URL (signed S3 GET URL).
   * Use isPdf true for PDFs (Responses API with input_file); false for images (Chat Completions vision)
   */
  async extractFromDocumentUrl(documentUrl: string, isPdf: boolean): Promise<ExtractedBookingFields> {
    if (isPdf) {
      return this.langGraphService.extractBookingFromPdfUrl(documentUrl);
    }
    return this.langGraphService.extractBookingFromDocumentUrl(documentUrl);
  }
}
