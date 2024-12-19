# playwright-mongodb-reporter

[![npm version](https://badge.fury.io/js/playwright-mongodb-reporter.svg)](https://badge.fury.io/js/playwright-mongodb-reporter)
[![Tests](https://github.com/yourusername/playwright-mongodb-reporter/workflows/Tests/badge.svg)](https://github.com/shane-reaume/playwright-mongodb-reporter/actions)
[![codecov](https://codecov.io/gh/yourusername/playwright-mongodb-reporter/branch/main/graph/badge.svg)](https://codecov.io/gh/shane-reaume/playwright-mongodb-reporter)

A MongoDB reporter for Playwright tests that saves your test results directly to MongoDB.

## Installation

```bash
npm install playwright-mongodb-reporter
```

## Usage

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import MongoReporter from 'playwright-mongodb-reporter';
export default defineConfig({
  reporter: [
    ['list'],
    ['playwright-mongodb-reporter', {
    mongoUri: 'your-mongodb-uri',
    dbName: 'your-database',
    collectionName: 'your-collection'
    }]
  ],
});
```