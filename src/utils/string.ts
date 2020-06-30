String.prototype.insertTag = function (index: number, offset: number, startTag: string, endTag: string): string {
  return this.substr(0, index) + startTag + this.substr(index, offset) + endTag + this.substr(index + offset);
};

String.prototype.escapeHtml = function () {
  return this
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&quot;')
    .replace(/'/g, '&#039;');
};
