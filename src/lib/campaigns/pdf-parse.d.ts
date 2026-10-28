declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (data: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
  export default parse;
}
