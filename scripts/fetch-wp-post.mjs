import fetch from 'node-fetch';

const url = 'https://www.whitecollaradvice.com/wp-json/wp/v2/posts?slug=what-books-should-i-read-in-prison&_embed=1';

async function fetchPost() {
  const res = await fetch(url);
  const json = await res.json();
  console.log('--- FETCH SPECIFIC WP POST ---');
  console.log(`Length: ${json.length}`);
  if (json.length > 0) {
    console.log(`Title: ${json[0].title.rendered}`);
    console.log(`Slug: ${json[0].slug}`);
    console.log(`Status: ${json[0].status}`);
  }
}

fetchPost().catch(console.error);
