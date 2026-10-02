const test = require('node:test');
const assert = require('node:assert/strict');
const parseYouTubeVideoId = require('./youtube-video');

test('parses supported YouTube watch, short, and embed links', () => {
  const id = 'AbCdEf_1234';
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(parseYouTubeVideoId(`https://youtube.com/watch?feature=share&v=${id}&t=20`), id);
  assert.equal(parseYouTubeVideoId(`https://youtu.be/${id}?si=share`), id);
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/embed/${id}?start=12`), id);
  assert.equal(parseYouTubeVideoId(`https://youtube.com/embed/${id}`), id);
});

test('rejects arbitrary hosts, unsupported paths, malformed ids, and unsafe URL credentials', () => {
  const id = 'AbCdEf_1234';
  for (const value of [
    `https://youtube.com.evil.example/watch?v=${id}`,
    `https://evil.youtube.com/watch?v=${id}`,
    `https://notyoutube.example/${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtu.be/${id}/extra`,
    'https://youtu.be/short',
    `https://user:pass@youtube.com/watch?v=${id}`,
    'not a URL',
  ]) assert.equal(parseYouTubeVideoId(value), null, value);
});
