const fetch = require('node-fetch');

async function test() {
  const res = await fetch('https://music.apple.com/profile/brian_meyer', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('Length:', html.length);
  console.log('Has __NEXT_DATA__:', html.includes('__NEXT_DATA__'));
  console.log('Has pl.:', html.includes('pl.'));
  console.log('Has playlist:', html.includes('playlist'));
  console.log('\n--- First 500 chars ---');
  console.log(html.substring(0, 500));
}

test().catch(console.error);
