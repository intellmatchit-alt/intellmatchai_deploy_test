/**
 * Type declarations for optional modules
 */

declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
  export = pdfParse;
}

declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: any[];
  }

  interface Options {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(options: Options): Promise<ExtractResult>;
}
