interface String {
  insertTag(index: number, offset: number, startTag: string, endTag: string): string 
  escapeHtml(): string;
}
