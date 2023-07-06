require("dotenv").config();
const axios = require('axios');
const fs = require('fs');

const API_TOKEN = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;

async function createZeroTrustList(name, items) {
  try {
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
    console.log(`Created Zero Trust list "${name}" with ID ${listId}`);
  } catch (error) {
    console.error(`Error creating list "${name}": ${error.response.data}`);
  }
}

async function processInputFile(inputFilePath) {
  const fileContent = fs.readFileSync(inputFilePath, 'utf8');

  const lines = fileContent.split('\n');
  const regexLines = lines.filter(line => line.startsWith('/') && line.endsWith('/'));

  const listsToCreate = Math.ceil(regexLines.length / 1000);

  console.log(`Found ${regexLines.length} valid domain patterns in the input file - ${listsToCreate} list(s) will be created`);

  const chunks = chunkArray(regexLines, 1000);

  for (const [index, chunk] of chunks.entries()) {
    const listName = `CGPS List - Chunk ${index}`;
    const items = chunk.map(line => ({ value: line.substring(1, line.length - 1), is_regex: true }));

    await createZeroTrustList(listName, items);
  }
}

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

const inputFilePath = 'input.csv';
processInputFile(inputFilePath);
