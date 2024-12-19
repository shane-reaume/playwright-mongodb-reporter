# playwright-mongodb-reporter

[![Tests](https://github.com/shane-reaume/playwright-mongodb-reporter/actions/workflows/test.yml/badge.svg)](https://github.com/shane-reaume/playwright-mongodb-reporter/actions/workflows/test.yml)
[![NPM Version](https://img.shields.io/npm/v/playwright-mongodb-reporter.svg)](https://www.npmjs.com/package/playwright-mongodb-reporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/shane-reaume/playwright-mongodb-reporter/branch/master/graph/badge.svg)](https://codecov.io/gh/shane-reaume/playwright-mongodb-reporter)

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