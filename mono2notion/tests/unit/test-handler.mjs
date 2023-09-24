const AWSMock = require('aws-sdk-mock');
const { handler } = require('../../index.js');

describe('Lambda handler', () => {

    // Mock S3 getObject call
    beforeEach(() => {
        AWSMock.mock('S3', 'getObject', (params, callback) => {
            callback(null, { Body: 'Your CSV content here' });
        });
    });

    afterEach(() => {
        AWSMock.restore('S3');
    });

    it('should process CSV successfully', async () => {
        // Mock event
        const mockEvent = {
            Records: [{
                s3: {
                    bucket: { name: 'test-bucket' },
                    object: { key: 'test-key.csv' }
                }
            }]
        };

        const result = await handler(mockEvent);

        // Check if processing was successful
        expect(result.statusCode).toEqual(200);
        expect(result.body).toEqual(JSON.stringify({ message: 'Data processed successfully' }));
    });

    // Add more tests as needed
});
