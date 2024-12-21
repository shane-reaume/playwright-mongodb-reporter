import { test, expect } from '@playwright/test';
import MongoReporter from '../src';
import type {
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter';
import type { MongoClient } from 'mongodb';

// Define a TestError class
class TestError extends Error {
  cause?: TestError;
  constructor(message: string, cause?: TestError) {
    super(message);
    this.cause = cause;
  }
}

test.describe('MongoReporter', () => {
  let reporter: MongoReporter;
  let connectCalls = 0;
  let closeCalls = 0;
  let updateOneCalls: Array<{ filter: any; update: any }> = [];

  const mockCollection = {
    updateOne: async (filter: any, update: any) => {
      updateOneCalls.push({ filter, update });
      return Promise.resolve({ acknowledged: true });
    },
  };

  const mockDb = {
    collection: () => mockCollection,
    admin: () => ({
      ping: async () => Promise.resolve(),
    }),
  };

  const mockClient = {
    connect: async () => {
      connectCalls++;
      return Promise.resolve();
    },
    db: () => mockDb,
    close: async () => {
      closeCalls++;
      return Promise.resolve();
    },
  };

  const mockClientFactory = () => mockClient as unknown as MongoClient;

  const mockConfig: FullConfig = {
    projects: [],
    rootDir: '',
    version: '',
    workers: 1,
    grep: /.*/,
    grepInvert: null,
    preserveOutput: 'always',
    reporter: [],
    reportSlowTests: null,
    quiet: false,
    maxFailures: 0,
    shard: null,
    updateSnapshots: 'none',
    metadata: {},
    webServer: null,
    forbidOnly: false,
    fullyParallel: false,
    globalSetup: null,
    globalTeardown: null,
    globalTimeout: 0,
  };

  const mockSuite: Suite = {
    allTests: () => [],
    title: '',
    project: () => undefined,
    suites: [],
    tests: [],
    entries: () => [],
    titlePath: () => [],
    location: undefined,
    type: 'describe',
  };

  test.beforeEach(async () => {
    // Reset counters
    connectCalls = 0;
    closeCalls = 0;
    updateOneCalls = [];

    reporter = new MongoReporter({
      mongoUri: 'mongodb://fake-uri',
      dbName: 'test-db',
      collectionName: 'test-collection',
      _mongoClientFactory: mockClientFactory,
    });
  });

  test('initializes with correct configuration', async () => {
    expect(reporter['mongoUri']).toBe('mongodb://fake-uri');
    expect(reporter['dbName']).toBe('test-db');
    expect(reporter['collectionName']).toBe('test-collection');
  });

  test('connects to MongoDB on begin', async () => {
    await reporter.onBegin(mockConfig, mockSuite);
    expect(connectCalls).toBe(1);
  });

  test('stores test results correctly', async () => {
    await reporter.onBegin(mockConfig, mockSuite);

    const testCase: TestCase = {
      title: 'Store A -|- Blah Subtitle',
      parent: {
        title: 'Chrome -|- Group 1',
        allTests: () => [],
        project: () => undefined,
        suites: [],
        tests: [],
        entries: () => [],
        titlePath: () => [],
        location: undefined,
        type: 'describe',
      },
      expectedStatus: 'passed',
      timeout: 0,
      annotations: [],
      retries: 0,
      results: [],
      location: { file: '', line: 0, column: 0 },
      id: '',
      outcome: () => 'expected' as const,
      ok: () => true,
      titlePath: () => [],
      repeatEachIndex: 0,
      tags: [],
      type: 'test',
    };

    const result: TestResult = {
      status: 'passed',
      duration: 1000,
      retry: 0,
      startTime: new Date(),
      attachments: [],
      stdout: [],
      stderr: [],
      steps: [],
      errors: [],
      error: undefined,
      parallelIndex: 0,
      workerIndex: 0,
    };

    await reporter.onTestBegin(testCase);
    await reporter.onTestEnd(testCase, result);
    console.log('Filter object:', updateOneCalls[0].filter);

    expect(updateOneCalls.length).toBe(1);
    expect(updateOneCalls[0].filter).toMatchObject({
      suite_title: 'Chrome',
      suite_title_sub: 'Group 1',
      test_case: 'Store A',
      test_case_sub: 'Blah Subtitle',
    });
  });

  test('handles MongoDB connection errors', async () => {
    const errorClient = {
      ...mockClient,
      connect: async () => {
        throw new Error('Connection failed');
      },
    };

    reporter = new MongoReporter({
      mongoUri: 'mongodb://fake-uri',
      dbName: 'test-db',
      collectionName: 'test-collection',
      _mongoClientFactory: () => errorClient as unknown as MongoClient,
    });

    await expect(reporter.onBegin(mockConfig, mockSuite)).rejects.toThrow('Connection failed');
  });

  test('closes MongoDB connection on end', async () => {
    await reporter.onBegin(mockConfig, mockSuite);

    const fullResult: FullResult = {
      status: 'passed',
      startTime: new Date(),
      duration: 1000,
    };

    await reporter.onEnd(fullResult);
    expect(closeCalls).toBe(1);
  });

  test('handles missing credentials correctly', async () => {
    await expect(() => new MongoReporter({})).toThrow('MongoDB credentials not provided');
  });

  test('handles environment variables for MongoDB configuration', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    process.env.MONGODB_DB_NAME = 'env-db';
    process.env.MONGODB_COLLECTION = 'env-collection';

    const envReporter = new MongoReporter();
    expect(envReporter['mongoUri']).toBe('mongodb://env-uri');
    expect(envReporter['dbName']).toBe('env-db');
    expect(envReporter['collectionName']).toBe('env-collection');

    // Clean up
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    delete process.env.MONGODB_COLLECTION;
  });

  test('handles environment variables for credentials', async () => {
    process.env.MONGODB_USER = 'env-user';
    process.env.MONGODB_PASSWORD = 'env-pass';
    process.env.MONGODB_HOST = 'env-host';
    process.env.MONGODB_PORT = '27018';
    process.env.MONGODB_AUTH_SOURCE = 'env-auth';

    const envReporter = new MongoReporter({});
    expect(envReporter['mongoUri']).toBe(
      'mongodb://env-user:env-pass@env-host:27018/?authSource=env-auth'
    );

    // Clean up
    delete process.env.MONGODB_USER;
    delete process.env.MONGODB_PASSWORD;
    delete process.env.MONGODB_HOST;
    delete process.env.MONGODB_PORT;
    delete process.env.MONGODB_AUTH_SOURCE;
  });

  test('handles reconnection attempts on write failure', async () => {
    let connectionAttempts = 0;
    const reconnectClient = {
      ...mockClient,
      connect: async () => {
        connectionAttempts++;
        if (connectionAttempts === 1) {
          throw new Error('Initial connection failed');
        }
        return Promise.resolve();
      },
      db: () => ({
        ...mockDb,
        admin: () => ({
          ping: async () => {
            throw new Error('Connection lost');
          },
        }),
      }),
    };

    reporter = new MongoReporter({
      mongoUri: 'mongodb://fake-uri',
      _mongoClientFactory: () => reconnectClient as unknown as MongoClient,
    });

    await reporter.onBegin(mockConfig, mockSuite);

    const testCase: TestCase = {
      title: 'Test Case',
      parent: {
        title: 'Test Suite',
        allTests: () => [],
        project: () => undefined,
        suites: [],
        tests: [],
        entries: () => [],
        titlePath: () => [],
        location: undefined,
        type: 'describe',
      },
      expectedStatus: 'passed',
      timeout: 0,
      annotations: [],
      retries: 0,
      results: [],
      location: { file: '', line: 0, column: 0 },
      id: '',
      outcome: () => 'expected' as const,
      ok: () => true,
      titlePath: () => [],
      repeatEachIndex: 0,
      tags: [],
      type: 'test',
    };

    const result: TestResult = {
      status: 'passed',
      duration: 1000,
      retry: 0,
      startTime: new Date(),
      attachments: [],
      stdout: [],
      stderr: [],
      steps: [],
      errors: [],
      error: {
        message: 'Test error message',
        stack: 'stack trace',
        value: 'Test error message',
      },
      parallelIndex: 0,
      workerIndex: 0,
    };

    await reporter.onTestBegin(testCase);
    await reporter.onTestEnd(testCase, result);
    expect(connectionAttempts).toBeGreaterThan(1);
  });

  test('handles test results with error messages', async () => {
    await reporter.onBegin(mockConfig, mockSuite);

    const testCase: TestCase = {
      title: 'Failed Test',
      parent: {
        title: 'Error Suite',
        allTests: () => [],
        project: () => undefined,
        suites: [],
        tests: [],
        entries: () => [],
        titlePath: () => [],
        location: undefined,
        type: 'describe',
      },
      expectedStatus: 'failed',
      timeout: 0,
      annotations: [],
      retries: 2,
      results: [],
      location: { file: '', line: 0, column: 0 },
      id: '',
      outcome: () => 'unexpected' as const,
      ok: () => false,
      titlePath: () => [],
      repeatEachIndex: 0,
      tags: [],
      type: 'test',
    };

    const result: TestResult = {
      status: 'failed',
      duration: 1000,
      retry: 2,
      startTime: new Date(),
      attachments: [],
      stdout: [],
      stderr: [],
      steps: [],
      errors: [new TestError('First error'), new TestError('Second error')],
      error: new TestError('Main error message'),
      parallelIndex: 0,
      workerIndex: 0,
    };

    await reporter.onTestBegin(testCase);
    await reporter.onTestEnd(testCase, result);

    expect(updateOneCalls.length).toBe(1);
    expect(updateOneCalls[0].update.$set.error).toBe('Main error message');
    expect(updateOneCalls[0].update.$set.retry).toBe(2);
  });

  test('handles connection close errors', async () => {
    const errorOnCloseClient = {
      ...mockClient,
      close: async () => {
        throw new Error('Failed to close connection');
      },
      db: () => ({
        ...mockDb,
        admin: () => ({
          ping: async () => Promise.resolve(),
        }),
      }),
    };

    reporter = new MongoReporter({
      mongoUri: 'mongodb://fake-uri',
      _mongoClientFactory: () => errorOnCloseClient as unknown as MongoClient,
    });

    await reporter.onBegin(mockConfig, mockSuite);

    const fullResult: FullResult = {
      status: 'passed',
      startTime: new Date(),
      duration: 1000,
    };

    // This should not throw but should log the error
    await reporter.onEnd(fullResult);
  });

  test('handles missing test group names', async () => {
    await reporter.onBegin(mockConfig, mockSuite);

    const testCase: TestCase = {
      title: 'Simple Test',
      parent: {
        title: '', // Empty title
        allTests: () => [],
        project: () => undefined,
        suites: [],
        tests: [],
        entries: () => [],
        titlePath: () => [],
        location: undefined,
        type: 'describe',
      },
      expectedStatus: 'passed',
      timeout: 0,
      annotations: [],
      retries: 0,
      results: [],
      location: { file: '', line: 0, column: 0 },
      id: '',
      outcome: () => 'expected' as const,
      ok: () => true,
      titlePath: () => [],
      repeatEachIndex: 0,
      tags: [],
      type: 'test',
    };

    const result: TestResult = {
      status: 'passed',
      duration: 1000,
      retry: 0,
      startTime: new Date(),
      attachments: [],
      stdout: [],
      stderr: [],
      steps: [],
      errors: [],
      error: undefined,
      parallelIndex: 0,
      workerIndex: 0,
    };

    await reporter.onTestBegin(testCase);
    await reporter.onTestEnd(testCase, result);

    // Should not attempt to write to MongoDB when group name is empty
    expect(updateOneCalls.length).toBe(0);
  });
});
