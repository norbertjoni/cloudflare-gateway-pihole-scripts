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
    // Fetch data from the provided URL
    const response = await axios.get('https://big.oisd.nl/regex');
    const data = response.data;

    // Remove lines starting with "#"
    let domains = data.split('\n').filter(line => !line.trim().startsWith('#'));

    // Trim array to 300,000 domains if it's longer than that
    if (domains.length > LIST_ITEM_LIMIT) {
      domains = trimArray(domains, LIST_ITEM_LIMIT);
      console.warn(`More than ${LIST_ITEM_LIMIT} domains found in input - input has to be trimmed`);
    }

    const listsToCreate = Math.ceil(domains.length / 1000);

    if (!process.env.CI) {
      console.log(`Found ${domains.length} valid domains in input - ${listsToCreate} list(s) will be created`);
    }

    // Separate domains into chunks of 1000 (Cloudflare list cap)
    const chunks = chunkArray(domains, 1000);

    // Create Cloudflare Zero Trust lists
    for (const [index, chunk] of chunks.entries()) {
      const listName = `CGPS List - Chunk ${index}`;

      let properList = chunk.map(domain => ({ value: domain }));

      try {
        await createZeroTrustList(listName, properList, (index + 1), listsToCreate);
        await sleep(350); // Sleep for 350ms between list additions
      } catch (error) {
        console.error(`Error creating list ${process.env.CI ? "(redacted on CI)" : `"${listName}": ${error.response.data}`}`);
      }
    }
  } catch (error) {
    console.error('Error fetching data from the provided URL:', error);
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
  const response = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`,
    {
      name,
      type: 'DOMAIN',
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
  console.log(`Created Zero Trust list ${process.env.CI ? "(redacted on CI)" : `"${name}" with ID ${listId} - ${totalItems - currentItem} left"`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runScript();
