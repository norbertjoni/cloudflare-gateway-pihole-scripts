require("dotenv").config();
const fs = require('fs');
const axios = require('axios');

const API_TOKEN = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;

let domains = []; // Define an empty array for the domains

// Read input.csv and parse domains
fs.readFile('input.csv', 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading input.csv:', err);
    return;
  }

  // Convert into array and cleanup input
  domains = data.split('\n').filter(line => !line.startsWith('#') && line.trim() !== '');

  const listsToCreate = Math.ceil(domains.length / 1000);

  console.log(`Found ${domains.length} valid domains in input.csv after cleanup - ${listsToCreate} list(s) will be created`);

  // Separate domains into chunks of 1000 (Cloudflare list cap)
  const chunks = chunkArray(domains, 1000);

  // Create Cloudflare Zero Trust lists
  for (const [index, chunk] of chunks.entries()) {
    const listName = `CGPS List - Chunk ${index}`;

    let properList = chunk.map(domain => ({ value: domain }));

    try {
      await createZeroTrustList(listName, properList, (index+1), listsToCreate);
      await sleep(350); // Sleep for 350ms between list additions
    } catch (error) {
      console.error(`Error creating list `, process.env.CI ? "(redacted on CI)" :  `"${listName}": ${error.response.data}`);
    }
  }
});

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Function to create a Cloudflare Zero Trust list
async function createZeroTrustList(name, items, currentItem, totalItems) {
  const response = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`,
    {
      name,
      type: 'DOMAIN', // Set list type to DOMAIN
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
  console.log(`Created Zero Trust list`, process.env.CI ? "(redacted on CI)" : `"${name}" with ID ${listId} - ${totalItems - currentItem} left`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
