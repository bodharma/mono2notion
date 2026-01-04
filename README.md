# mono2notion

Automated Monobank transaction importer for Notion databases. This serverless application eliminates manual data entry by automatically processing Monobank CSV exports and populating Notion expense tracking databases.

## Overview

mono2notion is an AWS Lambda-based automation tool that bridges Monobank (Ukrainian banking platform) transaction exports with Notion databases. Upload a CSV export from Monobank to an S3 bucket, and the Lambda function automatically parses, normalizes, and imports all transactions into your configured Notion database.

## Problem Statement

Manual financial tracking is time-consuming and error-prone. Users who want to track their Monobank transactions in Notion face several challenges:

- Manual copy-paste of transaction data from CSV exports
- Data format inconsistencies between Monobank exports and Notion
- Time-consuming conversion of currency exchange rates
- Risk of data entry errors
- Difficulty maintaining consistent expense tracking

mono2notion solves these problems by providing a fully automated pipeline from Monobank CSV export to Notion database entries.

## Features

- **Automated CSV Processing**: Parses Monobank transaction CSV exports with Ukrainian field names
- **Data Normalization**: Transforms raw transaction data into Notion-compatible format
- **Multi-Currency Support**: Handles both UAH (Ukrainian Hryvnia) and EUR transactions with exchange rates
- **Date Format Conversion**: Converts Monobank date format (DD.MM.YYYY HH:MM:SS) to ISO 8601
- **Transaction Filtering**: Excludes internal transfers (FOP account transfers)
- **Resilient API Calls**: Implements exponential backoff retry logic for Notion API reliability
- **Event-Driven Architecture**: S3-triggered Lambda execution for seamless automation
- **Local Testing Support**: Can run locally for development and testing

## Architecture

```
Monobank CSV Export
       |
       v
   AWS S3 Bucket (Upload)
       |
       v
   AWS Lambda Trigger
       |
       v
   Process & Normalize Data
       |
       v
   Notion API (Create Pages)
       |
       v
   Notion Database (Populated)
```

### Technology Stack

- **Runtime**: Node.js 18
- **Cloud Provider**: AWS (Lambda, S3, IAM, CloudFormation)
- **Infrastructure as Code**: AWS SAM (Serverless Application Model)
- **Containerization**: Docker (AWS Lambda container image)
- **External API**: Notion API v2021-08-16
- **Dependencies**:
  - `aws-sdk`: AWS service integration
  - `axios`: HTTP client for Notion API
  - `csv-parser`: CSV file parsing

## Data Flow

1. User exports transactions from Monobank as CSV
2. User uploads CSV to designated S3 bucket (bananaBucket)
3. S3 ObjectCreated:Put event triggers Lambda function
4. Lambda downloads CSV from S3 to /tmp directory
5. CSV parser reads and structures transaction data
6. Normalization function:
   - Filters out internal FOP transfers
   - Extracts transaction details (Title, Amount UAH, Amount EUR, Exchange Rate, Date)
   - Converts dates to ISO 8601 format
   - Calculates absolute values for amounts
7. For each transaction:
   - Lambda sends POST request to Notion API
   - Creates new page in specified database
   - Implements retry logic for failed requests
8. Returns success/failure status

## Notion Database Schema

The target Notion database should have the following properties:

| Property Name | Property Type | Description |
|--------------|---------------|-------------|
| Title | Title | Transaction description from Monobank |
| Amount (UAH) | Number | Transaction amount in Ukrainian Hryvnia |
| Amount (EUR) | Number | Transaction amount in Euros (if applicable) |
| Exchange | Number | Currency exchange rate (if applicable) |
| Date | Date | Transaction timestamp (ISO 8601) |

## Monobank CSV Format

Expected CSV columns (Ukrainian):
- `Деталі операції` - Transaction details/description
- `Сума в валюті картки (UAH)` - Amount in card currency (UAH)
- `Сума в валюті операції` - Amount in transaction currency
- `Курс` - Exchange rate
- `Дата i час операції` - Date and time of operation (DD.MM.YYYY HH:MM:SS)

## Setup and Deployment

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- SAM CLI installed
- Docker installed
- Node.js 18
- Notion account with API integration
- Monobank account (Ukrainian bank)

### Configuration Steps

1. **Create Notion Integration**
   - Go to https://www.notion.so/my-integrations
   - Create new integration and obtain API key
   - Share target database with integration

2. **Configure Environment Variables**

   Edit `/Users/bodharma/dev/personal/mono2notion/mono2notion/index.js`:

   ```javascript
   const NOTION_API_KEY = "your_notion_api_key_here";
   const NOTION_DB_URL = "your_notion_database_url_here";
   ```

3. **Update AWS Template**

   Edit `/Users/bodharma/dev/personal/mono2notion/template.yaml`:

   Replace placeholders:
   - `<ACCOUNT_ID>`: Your AWS account ID
   - `<REGION>`: Your AWS region (e.g., eu-central-1)
   - `<REPOSITORY_NAME>`: Your ECR repository name
   - `bananaBucket`: Your desired S3 bucket name

4. **Build Application**

   ```bash
   sam build
   ```

5. **Deploy to AWS**

   ```bash
   sam deploy --guided
   ```

   Follow prompts to configure:
   - Stack name
   - AWS Region
   - Confirm IAM role creation
   - Save configuration to samconfig.toml

### Local Testing

Test the function locally without deploying:

```bash
# Install dependencies
cd mono2notion
npm install

# Place test CSV file in mono2notion directory
# Update local file path in index.js (line 190)

# Run locally
node index.js
```

Or test with SAM CLI:

```bash
sam build
sam local invoke Mono2NotionFunction --event events/event.json
```

## Usage

1. Export transaction history from Monobank as CSV
2. Upload CSV file to configured S3 bucket
3. Lambda function triggers automatically
4. Check Notion database for imported transactions
5. Review CloudWatch Logs for execution details

## Monitoring

View Lambda execution logs:

```bash
sam logs -n Mono2NotionFunction --stack-name mono2notion --tail
```

CloudWatch Logs include:
- CSV processing status
- Notion API request outcomes
- Retry attempts and failures
- Individual transaction processing results

## Error Handling

The application includes robust error handling:

- **Exponential Backoff**: Retries failed Notion API calls up to 5 times with increasing delays
- **Individual Transaction Failures**: Logs failed transactions without stopping batch processing
- **Connection Errors**: Differentiates between timeout and connection errors
- **CSV Parsing Errors**: Catches and logs file reading issues

## Project Status: Archived

This project was created in September 2023 as a personal automation tool and is currently archived. Indicators of archived status:

- Single initial commit (42706e3) with no subsequent development
- Untracked configuration files (.gitignore, .idea/)
- Hardcoded API keys and database IDs (security concern for production)
- GitHub Actions workflow configured for 'main' branch but repository uses 'master'
- No ongoing maintenance or updates

### Why Archived?

Likely reasons for archival:
1. **Personal Use Case Fulfilled**: Served specific personal need, no longer required
2. **Security Considerations**: Contains hardcoded credentials unsuitable for public repository
3. **Limited Scope**: Highly specific to Monobank/Notion integration
4. **Manual Maintenance**: Requires manual CSV uploads rather than direct API integration
5. **Migration to Alternative**: User may have migrated to Monobank's native integrations or other solutions

## Potential Improvements

If this project were to be revived or forked, consider:

### Security Enhancements
- Move API keys and secrets to AWS Secrets Manager or Parameter Store
- Implement environment variable-based configuration
- Remove hardcoded credentials from source code
- Add .env file support for local development

### Feature Additions
- Direct Monobank API integration (eliminate CSV step)
- Support for multiple Notion databases
- Transaction categorization and tagging
- Duplicate transaction detection
- Configurable field mapping
- Multi-currency support beyond UAH/EUR
- Email notifications on import completion
- Error reporting and alerting

### Architecture Improvements
- Add API Gateway endpoint for manual triggering
- Implement SQS queue for batch processing
- Add DynamoDB for transaction deduplication
- Create CloudFormation/CDK infrastructure templates
- Implement proper CI/CD pipeline
- Add comprehensive integration tests
- Create user-friendly deployment script

### Code Quality
- TypeScript migration for type safety
- Comprehensive unit test coverage
- Integration tests with mocked services
- ESLint and Prettier configuration
- Documentation generation (JSDoc)
- Error handling improvements
- Logging standardization

## Technical Debt

Known issues and limitations:

1. **Hardcoded Configuration**: API keys and database IDs in source code
2. **Missing Environment Variables**: No proper configuration management
3. **Incomplete GitHub Actions**: Workflow has placeholder values
4. **Branch Mismatch**: Workflow targets 'main', repository uses 'master'
5. **No Transaction Deduplication**: May create duplicate entries on re-upload
6. **Limited Error Context**: Generic error messages without transaction details
7. **No Input Validation**: Assumes CSV format is always correct
8. **Timeout Risk**: Fixed 3-second Lambda timeout may be insufficient for large files
9. **No Progress Tracking**: Cannot resume partial imports
10. **Test Coverage**: Single placeholder test, no real test coverage

## Security Considerations

IMPORTANT SECURITY WARNINGS:

- API keys are hardcoded in source code (lines 9-12 of index.js)
- Never commit actual API keys to version control
- Use AWS Secrets Manager for production deployments
- Implement least-privilege IAM policies
- Enable S3 bucket encryption
- Restrict S3 bucket access to Lambda execution role only
- Implement API rate limiting for Notion calls
- Validate CSV file contents before processing
- Sanitize transaction descriptions before sending to Notion

## License

MIT (as indicated in package.json)

## Author

Bohdan-Volodymyr Lesiv (bodharma@brain.local)
Created: September 24, 2023

## Related Projects

Alternative approaches to Monobank/Notion integration:
- Zapier integration (no-code solution)
- n8n workflow automation (open-source)
- Direct Monobank API webhooks to Notion
- Banking aggregators with Notion connectors

## Contributing

This project is archived and not actively maintained. If you find it useful:

1. Fork the repository
2. Implement security improvements (remove hardcoded secrets)
3. Add your desired features
4. Consider making it a reusable template for other bank/Notion integrations

## Acknowledgments

- Built with AWS SAM (Serverless Application Model)
- Uses Notion API for database operations
- Designed for Monobank (Ukrainian banking platform)
- Inspired by personal expense tracking needs

---

For questions about Monobank API, visit: https://api.monobank.ua/docs/
For Notion API documentation, visit: https://developers.notion.com/
