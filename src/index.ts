import {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter';
import { MongoClient, Collection } from 'mongodb';

interface MongoReporterOptions {
  mongoUri?: string;
  credentials?: {
    username?: string;
    password?: string;
    host?: string;
    port?: string;
    authSource?: string;
  };
  dbName?: string;
  collectionName?: string;
  _mongoClientFactory?: (uri: string) => MongoClient;
}

class MongoReporter implements Reporter {
  private client!: MongoClient;
  private collection!: Collection;
  private currentGroupName: string = '';
  private currentTestName: string = '';
  private mongoUri: string;
  private dbName: string;
  private collectionName: string;
  private mongoClientFactory: (uri: string) => MongoClient;

  constructor(options: MongoReporterOptions = {}) {
    this.mongoUri = this.buildMongoUri(options);
    this.dbName = options.dbName || process.env.MONGODB_DB_NAME || 'testResults';
    this.collectionName =
      options.collectionName || process.env.MONGODB_COLLECTION || 'test_results';
    this.mongoClientFactory =
      options._mongoClientFactory || ((uri: string) => new MongoClient(uri));
  }

  private buildMongoUri(options: MongoReporterOptions): string {
    if (options.mongoUri) {
      return options.mongoUri;
    }

    if (process.env.MONGODB_URI) {
      return process.env.MONGODB_URI;
    }

    const username = options.credentials?.username || process.env.MONGODB_USER;
    const password = options.credentials?.password || process.env.MONGODB_PASSWORD;
    const host = options.credentials?.host || process.env.MONGODB_HOST || 'localhost';
    const port = options.credentials?.port || process.env.MONGODB_PORT || '27017';
    const authSource =
      options.credentials?.authSource || process.env.MONGODB_AUTH_SOURCE || 'admin';

    if (!username || !password) {
      throw new Error(
        'MongoDB credentials not provided. Please provide either mongoUri, credentials object, or environment variables.'
      );
    }

    return `mongodb://${username}:${password}@${host}:${port}/?authSource=${authSource}`;
  }

  async onBegin(config: FullConfig, suite: Suite) {
    try {
      this.client = this.mongoClientFactory(this.mongoUri);
      await this.client.connect();
      this.collection = this.client.db(this.dbName).collection(this.collectionName);

      console.log(`Starting the run with ${suite.allTests().length} tests`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async onTestBegin(test: TestCase) {
    this.currentGroupName = test.parent.title;
    this.currentTestName = test.title;
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    console.log(`Finished test ${test.title}: ${result.status}`);
    await this.writeToMongo(test, result).catch((err) => {
      console.error('An error occurred while writing to MongoDB:', err);
    });
  }

  private async writeToMongo(test: TestCase, result: TestResult, retryCount = 0) {
    if (this.currentGroupName) {
      try {
        const [suite_title, suite_title_sub] = this.currentGroupName.split(' -|- ');
        const [test_case, test_case_sub] = this.currentTestName.split(' -|- ');

        const doc = {
          test_case,
          test_case_sub,
          result: result.status,
          duration: result.duration,
          timestamp: new Date(),
          suite_title,
          suite_title_sub,
          retry: test.retries,
          error: result.error?.message,
        };

        if (await this.isConnected()) {
          await this.collection.updateOne(
            {
              suite_title: doc.suite_title,
              suite_title_sub: doc.suite_title_sub,
              test_case: doc.test_case,
              test_case_sub: doc.test_case_sub,
            },
            { $set: doc },
            { upsert: true }
          );
        } else {
          console.error('MongoDB connection lost. Attempting to reconnect...');

          if (retryCount < 3) {
            await this.client.connect();
            await this.writeToMongo(test, result, retryCount + 1);
          } else {
            console.error('Failed to reconnect after 3 attempts');
          }
        }
      } catch (error) {
        console.error('Error writing to MongoDB:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          console.error('Stack trace:', error.stack);
        }
      }
    }
  }

  private async isConnected(): Promise<boolean> {
    try {
      await this.client.db().admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  async onEnd(result: FullResult) {
    try {
      if (await this.isConnected()) {
        await this.client.close();
        console.log('MongoDB connection closed successfully');
      }
      console.log(`Finished the run: ${result.status}`);
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
}

export default MongoReporter;
