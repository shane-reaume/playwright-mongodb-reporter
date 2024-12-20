"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
class MongoReporter {
    constructor(options = {}) {
        this.currentGroupName = ''; // Initialize with empty string
        this.currentTestName = ''; // Initialize with empty string
        this.mongoUri = this.buildMongoUri(options);
        this.dbName = options.dbName || process.env.MONGODB_DB_NAME || 'testResults';
        this.collectionName = options.collectionName || process.env.MONGODB_COLLECTION || 'test_results';
    }
    buildMongoUri(options) {
        var _a, _b, _c, _d, _e;
        if (options.mongoUri) {
            return options.mongoUri;
        }
        if (process.env.MONGODB_URI) {
            return process.env.MONGODB_URI;
        }
        const username = ((_a = options.credentials) === null || _a === void 0 ? void 0 : _a.username) || process.env.MONGODB_USER;
        const password = ((_b = options.credentials) === null || _b === void 0 ? void 0 : _b.password) || process.env.MONGODB_PASSWORD;
        const host = ((_c = options.credentials) === null || _c === void 0 ? void 0 : _c.host) || process.env.MONGODB_HOST || 'localhost';
        const port = ((_d = options.credentials) === null || _d === void 0 ? void 0 : _d.port) || process.env.MONGODB_PORT || '27017';
        const authSource = ((_e = options.credentials) === null || _e === void 0 ? void 0 : _e.authSource) || process.env.MONGODB_AUTH_SOURCE || 'admin';
        if (!username || !password) {
            throw new Error('MongoDB credentials not provided. Please provide either mongoUri, credentials object, or environment variables.');
        }
        return `mongodb://${username}:${password}@${host}:${port}/?authSource=${authSource}`;
    }
    async onBegin(config, suite) {
        try {
            this.client = new mongodb_1.MongoClient(this.mongoUri);
            await this.client.connect();
            this.collection = this.client.db(this.dbName).collection(this.collectionName);
            console.log(`Starting the run with ${suite.allTests().length} tests`);
        }
        catch (error) {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }
    async onTestBegin(test) {
        this.currentGroupName = test.parent.title;
        this.currentTestName = test.title;
    }
    async onTestEnd(test, result) {
        console.log(`Finished test ${test.title}: ${result.status}`);
        await this.writeToMongo(test, result).catch(err => {
            console.error('An error occurred while writing to MongoDB:', err);
        });
    }
    async writeToMongo(test, result, retryCount = 0) {
        var _a, _b;
        if (this.currentGroupName) {
            try {
                const [browser_group, test_group] = this.currentGroupName.split(' - ');
                const [test_store, test_page_name, path] = this.currentTestName.split(' -|- ');
                const url = new URL(path);
                const test_path = url.pathname;
                const doc = {
                    test_store,
                    test_page_name,
                    test_path,
                    result: result.status,
                    duration: result.duration,
                    timestamp: new Date(),
                    browser_group,
                    test_group,
                    retry: test.retries,
                    error: (_a = result.error) === null || _a === void 0 ? void 0 : _a.message,
                    stack: (_b = result.error) === null || _b === void 0 ? void 0 : _b.stack
                };
                // Check connection status without using topology
                if (await this.isConnected()) {
                    await this.collection.updateOne({
                        browser_group: doc.browser_group,
                        test_group: doc.test_group,
                        test_store: doc.test_store,
                        test_page_name: doc.test_page_name,
                        test_path: doc.test_path
                    }, { $set: doc }, { upsert: true });
                }
                else {
                    console.error('MongoDB connection lost. Attempting to reconnect...');
                    if (retryCount < 3) {
                        await this.client.connect();
                        await this.writeToMongo(test, result, retryCount + 1);
                    }
                    else {
                        console.error('Failed to reconnect after 3 attempts');
                    }
                }
            }
            catch (error) {
                console.error('Error writing to MongoDB:', error);
                if (error instanceof Error) {
                    console.error('Error details:', error.message);
                    console.error('Stack trace:', error.stack);
                }
            }
        }
    }
    // Helper method to check connection status
    async isConnected() {
        try {
            // Ping the database to check connection
            await this.client.db().admin().ping();
            return true;
        }
        catch {
            return false;
        }
    }
    // Fix the onEnd signature to match the Reporter interface
    async onEnd(result) {
        try {
            if (await this.isConnected()) {
                await this.client.close();
                console.log('MongoDB connection closed successfully');
            }
            console.log(`Finished the run: ${result.status}`);
        }
        catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }
}
exports.default = MongoReporter;
