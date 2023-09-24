const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

const NOTION_API_ENDPOINT = "https://api.notion.com/v1/pages";
const NOTION_API_KEY = "";

const NOTION_DB_URL = "";
const NOTION_DB_ID = extractNotionDatabaseId(NOTION_DB_URL);

function extractNotionDatabaseId(url) {
    try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(part => part.trim() !== '');

        // The database ID is expected to be the third segment in the URL path.
        // For example: ['bodh', 'c7dd435944114d54a3bed9d6e76bc832']
        if (pathParts.length > 1) {
            return pathParts[1];
        }

        return null;
    } catch (err) {
        console.error('Invalid URL provided', err);
        return null;
    }
}


async function readCSV(filePath) {
    const data = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => data.push(row))
            .on('end', () => resolve(data))
            .on('error', reject);
    });
}

function convertToISO8601(dateString) {
    // Extract date and time components
    const [day, month, year, hours, minutes, seconds] = dateString.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/).slice(1);

    // Construct a new Date object
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    // Return the date in ISO 8601 format
    return date.toISOString();
}

function normalizeData(rows) {
    const filteredRows = rows.filter(row => row["Деталі операції"] !== "З гривневого рахунку ФОП");

    return filteredRows.map(row => {

        const exchangeValue = parseFloat(row["Курс"]);
        const isExchangeEmpty = isNaN(exchangeValue);

        return {
            "Title": row["Деталі операції"],
            "Amount (UAH)": Math.abs(parseFloat(row["Сума в валюті картки (UAH)"])),
            "Amount (EUR)": isExchangeEmpty ? 0 : Math.abs(parseFloat(row["Сума в валюті операції"])),
            "Exchange": isExchangeEmpty ? 0: parseFloat(row["Курс"]),
            "Date": convertToISO8601(row["Дата i час операції"])
        };
    });
}

async function exponentialBackoffRetry(fn, retries = 5, delay = 2000) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.code === 'ERR_BAD_RESPONSE') {
                throw error; // If the error is not a timeout, throw it immediately.
            }
            attempt++;
            if (attempt >= retries) {
                throw error;
            }
            console.log(`Timeout on attempt ${attempt}. Retrying in ${delay}ms...`);
            await sleep(delay);
            delay *= 2;  // Double the delay for the next attempt
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRowToNotion(item) {
    const config = {
        headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2021-08-16',
            'Content-Type': 'application/json'
        },
        timeout: 5000
    };
    const payload = {
        "parent": { "database_id": NOTION_DB_ID },
        "properties": {
            "Title": {
                "title": [
                    {
                        "text": {
                            "content": item.Title
                        }
                    }
                ]
            },
            "Amount (UAH)": {
                "number": item["Amount (UAH)"]  // Assuming Amount is a number property in Notion
            },
            "Amount (EUR)": {
                "number": item["Amount (EUR)"]  // Assuming Amount (EUR) is a number property in Notion
            },
            "Exchange": {
                "number": item.Exchange  // Assuming Exchange is a number property in Notion
            },
            "Date": {
                "date": {
                    "start": item.Date,  // Assuming Date in your data is in format 'YYYY-MM-DD'. Adjust if necessary.
                    "end": null
                }
            }
            // Add more properties here as needed
        }
    };
    await axios.post(NOTION_API_ENDPOINT, payload, config);
}
async function sendDataToNotion(normalizedData) {

    try {
        for (const item of normalizedData) {
            try {
                await exponentialBackoffRetry(() => sendRowToNotion(item));
            } catch (error) {
                console.error('Failed to send a row', item.Date,'to Notion after multiple retries:', error);
                // Handle or log the failed row. Maybe collect them for a later batch retry or reporting.
            }

        }
        return true;
    } catch (err) {
        console.error('Error sending data to Notion', err.message);
        return err;
    }
}

async function processCSV(filePath) {
    const rows = await readCSV(filePath);
    const normalizedData = normalizeData(rows);
    await sendDataToNotion(normalizedData);
}

// Detect execution environment
if (process.env.AWS_EXECUTION_ENV) {
    // AWS Lambda execution
    exports.handler = async (event) => {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
        const downloadPath = `/tmp/${key}`;

        await s3.getObject({ Bucket: bucket, Key: key }).promise()
            .then(data => fs.writeFileSync(downloadPath, data.Body));

        try {
            await processCSV(downloadPath);
            return {
                'statusCode': 200,
                'body': JSON.stringify({
                    message: 'Data processed successfully',
                })
            };
        } catch (err) {
            console.log('Error processing CSV', err);
            return err;
        }
    };
} else {
    // Local execution
    (async () => {
        const filePath = './report_24-09-2023_19-16-47.csv';
        await processCSV(filePath);
    })();
}
