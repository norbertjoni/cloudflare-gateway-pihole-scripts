require("dotenv").config();
const fs = require('fs');
const axios = require('axios');

const API_TOKEN = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;
const LIST_ITEM_LIMIT = Number.isSafeInteger(Number(process.env.CLOUDFLARE_LIST_ITEM_LIMIT)) ? Number(process.env.CLOUDFLARE_LIST_ITEM_LIMIT) : 300000;

if (!process.env.CI) console.log(`List item limit set to ${LIST_ITEM_LIMIT}`);

let whitelist = []; // Define an empty array for the whitelist

// Read whitelist.csv and parse
fs.readFile('whitelist.csv', 'utf8', async (err, data) => {
  if (err) {
    console.warn('Error reading whitelist.csv:', err);
    console.warn('Assuming whitelist is empty.');
  } else {
    whitelist = data.split('\n').filter(domain => {
      // Remove empty lines and lines starting with "#"
      return domain.trim() !== '' && !domain.startsWith('#');
    });
    console.log(`Found ${whitelist.length} valid domains in whitelist.`);
  }
});


// Read input.csv and parse domains
fs.readFile('input.csv', 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading input.csv:', err);
    return;
  }

  let domains = data.split('\n').filter(domain => {
    // Remove empty lines and lines starting with "#"
    return domain.trim() !== '' && !domain.startsWith('#');
  });

  // Check for duplicates in domains array
  let uniqueDomains = [];
  let seen = new Set(); // Use a set to store seen values
  for (let domain of domains) {
    if (!seen.has(domain)) { // If the domain is not in the set
      seen.add(domain); // Add it to the set
      uniqueDomains.push(domain); // Push the domain to the uniqueDomains array
    } else { // If the domain is in the set
      console.warn(`Duplicate domain found: ${domain} - removing`); // Log the duplicate domain
    }
  }

  // Replace domains array with uniqueDomains array
  domains = uniqueDomains;

  // Remove domains from the domains array that are present in the whitelist array
  domains = domains.filter(domain => {
    if (whitelist.includes(domain)) {
      console.warn(`Domain found in the whitelist: ${domain} - removing`);
      return false;
    }
    return true;
  });

  // Trim array to 300,000 domains if it's longer than that
  if (domains.length > LIST_ITEM_LIMIT) {
    domains = trimArray(domains, LIST_ITEM_LIMIT);
    console.warn(`More than ${LIST_ITEM_LIMIT} domains found in input.csv - input has to be trimmed`);
  }
  const listsToCreate = Math.ceil(domains.length / 1000);

  if (!process.env.CI) console.log(`Found ${domains.length} valid domains in input.csv after cleanup - ${listsToCreate} list(s) will be created`);

  // Create Cloudflare Zero Trust lists
  for (let index = 0; index < listsToCreate; index++) {
    const listName = `CGPS List - Chunk ${index}`;

    const start = index * 1000;
    const end = start + 1000;
    const chunk = domains.slice(start, end);

    const properList = chunk.map(domain => {
      return { value: domain };
    });

    try {
      await createZeroTrustList(listName, properList, (index + 1), listsToCreate);
      await sleep(350); // Sleep for 350ms between list additions
    } catch (error) {
      console.error(`Error creating list `, process.env.CI ? "(redacted on CI)" : `"${listName}":`, error.response.data);
    }
  }
});

function trimArray(arr, size) {
  return arr.slice(0, size);
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

// Function to sleep for a specified duration
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
