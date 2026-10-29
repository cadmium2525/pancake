import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMessage, scoreShareData, shareScore, SHARE_TAGS, type ScoreCard } from '../src/sharing';

const score: ScoreCard = { total: 1420, technique: 2200, art: 917, heat: [20, 21], integrity: .95 };
const url = 'https://cadmium2525.github.io/pancake/';
const file = new File(['test png'], 'pancake-axel-1420.png', { type: 'image/png' });

test('share message contains score, breakdown, sentence, hashtags and URL', () => {
  const text = scoreMessage(score, url);
  for (const part of ['1,420点', '2,200', '917', '60秒のパンケーキ演技', '#PANCAKEAXEL', '#パンケーキチャレンジ', url]) assert.ok(text.includes(part), part);
});
test('file share contains the image and complete text without a competing URL field', () => {
  const data = scoreShareData(score, url, file);
  assert.deepEqual(data.files, [file]); assert.equal(data.text, scoreMessage(score, url)); assert.equal('url' in data, false);
});
test('supported native share sends PNG and hashtags in one call', async () => {
  const sent: ShareData[] = [];
  const mode = await shareScore(score, url, file, { canShare: d => d?.files?.[0] === file, share: async d => { sent.push(d!); } });
  assert.equal(mode, 'image'); assert.equal(sent.length, 1); assert.deepEqual(sent[0].files, [file]); assert.ok(sent[0].text?.includes(SHARE_TAGS));
});
test('unsupported file share still sends full text rather than URL alone', async () => {
  let sent: ShareData | undefined;
  assert.equal(await shareScore(score, url, file, { canShare: () => false, share: async d => { sent = d; } }), 'text');
  assert.equal(sent?.files, undefined); assert.equal(sent?.text, scoreMessage(score, url)); assert.equal('url' in sent!, false);
});
test('without canShare the native share uses the full text fallback', async () => {
  let sent: ShareData | undefined;
  assert.equal(await shareScore(score, url, file, { share: async d => { sent = d; } }), 'text');
  assert.ok(sent?.text?.includes('1,420点')); assert.equal(sent?.files, undefined);
});
test('cancelling native share never opens a second share sheet', async () => {
  let calls = 0;
  await assert.rejects(() => shareScore(score, url, file, { canShare: () => true, share: async () => { calls++; throw new DOMException('cancelled', 'AbortError'); } }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
test('a rejected file type falls back to the same post text', async () => {
  const sent: ShareData[] = [];
  const mode = await shareScore(score, url, file, { canShare: () => true, share: async d => { sent.push(d!); if (d?.files) throw new TypeError('Files unsupported'); } });
  assert.equal(mode, 'text'); assert.equal(sent.length, 2); assert.equal(sent[0].text, sent[1].text); assert.equal(sent[1].files, undefined);
});
test('no native share reports unavailable so UI can save the PNG and copy text', async () => {
  assert.equal(await shareScore(score, url, file, {}), 'unavailable');
});
