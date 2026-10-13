import { DocumentExtractionService } from '../../../src/bookings/document-extraction.service';
import { mock } from '../helpers';

describe('DocumentExtractionService', () => {
  const fields = { startDate: '2026-01-01' };
  let langGraph: any, llmEval: any;
  let service: DocumentExtractionService;

  beforeEach(() => {
    langGraph = mock({ extractBookingFromPdfUrl: jest.fn(async () => fields), extractBookingFromDocumentUrl: jest.fn(async () => fields) });
    llmEval = mock();
    service = new DocumentExtractionService(langGraph, llmEval);
  });

  it('reads a PDF through the PDF path, judged without the source', async () => {
    await expect(service.extractFromDocumentUrl('https://doc', true)).resolves.toBe(fields);
    expect(langGraph.extractBookingFromPdfUrl).toHaveBeenCalledWith('https://doc');
    expect(llmEval.maybeEvaluateTask).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: [] }));
  });

  it('reads an image through the vision path, judged against the image', async () => {
    await service.extractFromDocumentUrl('https://img', false);
    expect(langGraph.extractBookingFromDocumentUrl).toHaveBeenCalledWith('https://img');
    expect(llmEval.maybeEvaluateTask).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: ['https://img'] }));
  });

  it('passes a model failure through', async () => {
    langGraph.extractBookingFromPdfUrl.mockRejectedValue(new Error('model down'));
    await expect(service.extractFromDocumentUrl('https://doc', true)).rejects.toThrow('model down');
  });
});
