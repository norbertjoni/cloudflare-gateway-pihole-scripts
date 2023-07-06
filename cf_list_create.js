const fs = require('fs');
const axios = require('axios');

const API_TOKEN = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;
const LIST_ITEM_LIMIT = Number.isSafeInteger(Number(process.env.CLOUDFLARE_LIST_ITEM_LIMIT)) ? Number(process.env.CLOUDFLARE_LIST_ITEM_LIMIT) : 300000;

if (!process.env.CI) {
  console.log(`List item limit set to ${LIST_ITEM_LIMIT}`);
}

async function runScript() {
  try {
    const response = await axios.get('https://big.oisd.nl/regex');
    const data = response.data;

    const patterns = data
      .split('\n')
      .filter(line => !line.trim().startsWith('#'));

    if (patterns.length > LIST_ITEM_LIMIT) {
      patterns.length = LIST_ITEM_LIMIT;
      console.warn(`More than ${LIST_ITEM_LIMIT} patterns found in input - input has been trimmed`);
    }

    if (!process.env.CI) {
      console.log(`Found ${patterns.length} valid patterns in input - creating lists`);
    }

    const chunks = chunkArray(patterns, 1000);

    for (let i = 0; i < chunks.length; i++) {
      const listName = `CGPS List - Chunk ${i}`;
      const items = chunks[i].map(pattern => ({ pattern }));

      await createZeroTrustList(listName, items, i + 1, chunks.length);
      await sleep(350);
    }
  } catch (error) {
    console.error('Error fetching data from the provided URL:', error);
    process.exit(1);
  }
}

function trimArray(arr, size) {
  return arr.slice(0, size);
}

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function createZeroTrustList(name, items, currentItem, totalItems) {
  try {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`,
      {
        name,
        type: 'REGEX',
        items,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Auth-Email': ACCOUNT_EMAIL,
          'X-Auth-Key': API_TOKEN,
        },
      }
    );

    const listId = response.data.result.id;
    console.log(`Created Zero Trust list "${name}" with ID ${listId} - ${totalItems - currentItem} left`);
  } catch (error) {
    console.error(`Error creating list "${name}":`, error.response.data);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runScript();
