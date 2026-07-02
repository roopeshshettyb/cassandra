import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { LangGraphService, ExtractedBookingFields } from '../langgraph/langgraph.service';
import { LlmEvalService } from '../llm-eval/llm-eval.service';
import { EvalDimension } from '../llm-eval/llm-eval.model';

@Injectable()
export class DocumentExtractionService {
  constructor(
    private readonly langGraphService: LangGraphService,
    @Inject(forwardRef(() => LlmEvalService)) private readonly llmEvalService: LlmEvalService,
  ) {}

  /**
   * Extract booking fields from a document URL (signed S3 GET URL).
   * Use isPdf true for PDFs (Responses API with input_file); false for images (Chat Completions vision)
   */
  async extractFromDocumentUrl(documentUrl: string, isPdf: boolean): Promise<ExtractedBookingFields> {
    const extracted = isPdf
      ? await this.langGraphService.extractBookingFromPdfUrl(documentUrl)
      : await this.langGraphService.extractBookingFromDocumentUrl(documentUrl);

    // Fire-and-forget: for images the judge re-reads the document; for PDFs
    // (which the judge can't ingest) it checks internal plausibility only.
    this.llmEvalService
      .maybeEvaluateTask({
        dimension: EvalDimension.DOCUMENT_EXTRACTION,
        taskDescription: `Extract booking/reservation fields (dates, guest name/email/phone, room, hotel) from a reservation ${isPdf ? 'PDF (source not attached — judge internal consistency and plausibility only)' : 'image (attached)'}.`,
        input: 'Source: uploaded reservation document.',
        output: JSON.stringify(extracted),
        imageUrls: isPdf ? [] : [documentUrl],
      })
      .catch(() => undefined);

    return extracted;
  }
}
