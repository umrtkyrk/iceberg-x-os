import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_ATTACHMENTS_PER_ITEM,
  cleanFileName,
  detectAttachment,
  parseAttachmentIds
} from '../src/services/attachment.service';

const bytes = (...values: number[]) => Buffer.from(values);

test('files are identified by their bytes, not their name or MIME type', () => {
  assert.equal(detectAttachment(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.extension, 'png');
  assert.equal(detectAttachment(bytes(0xff, 0xd8, 0xff, 0xe0))?.extension, 'jpg');
  assert.equal(detectAttachment(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))?.extension, 'webp');
  assert.equal(detectAttachment(Buffer.from('GIF89a...'))?.extension, 'gif');
  assert.deepEqual(detectAttachment(Buffer.from('%PDF-1.7\n...')), { kind: 'pdf', extension: 'pdf', mime: 'application/pdf' });
});

test('a DOCX is a ZIP that contains the Word document part', () => {
  const docx = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from('..[Content_Types].xml..word/document.xml..')]);
  assert.equal(detectAttachment(docx)?.kind, 'docx');
  // Any other ZIP (an .xlsx, a renamed archive) is refused.
  const xlsx = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from('..[Content_Types].xml..xl/workbook.xml..')]);
  assert.equal(detectAttachment(xlsx), null);
});

test('everything else is refused', () => {
  assert.equal(detectAttachment(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(detectAttachment(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectAttachment(bytes(0x4d, 0x5a, 0x90, 0x00)), null); // Windows executable
  assert.equal(detectAttachment(bytes(0xd0, 0xcf, 0x11, 0xe0)), null); // legacy .doc
  assert.equal(detectAttachment(Buffer.alloc(0)), null);
});

test('file names keep their text but lose paths and control characters', () => {
  assert.equal(cleanFileName('../../etc/passwd', 'pdf'), 'passwd');
  assert.equal(cleanFileName('C:\\Users\\me\\Rapor Öğrenci.pdf', 'pdf'), 'Rapor Öğrenci.pdf');
  assert.equal(cleanFileName('a"b\u0000c.png', 'png'), 'abc.png');
  assert.equal(cleanFileName('', 'docx'), 'attachment.docx');
  assert.equal(cleanFileName('x'.repeat(300), 'pdf').length, 120);
});

test('attachment_ids must be a short list of unique strings', () => {
  assert.deepEqual(parseAttachmentIds(undefined), []);
  assert.deepEqual(parseAttachmentIds(['a', 'a', 'b']), ['a', 'b']);
  assert.throws(() => parseAttachmentIds('a'));
  assert.throws(() => parseAttachmentIds([1]));
  assert.throws(() => parseAttachmentIds(Array.from({ length: MAX_ATTACHMENTS_PER_ITEM + 1 }, (_, i) => `id${i}`)));
});
