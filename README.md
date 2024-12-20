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

## Basic Setup Examples

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import MongoReporter from 'playwright-mongodb-reporter';
export default defineConfig({
  reporter: [
    ['playwright-mongodb-reporter', {
    mongoUri: 'your-mongodb-uri',
    dbName: 'your-database',
    collectionName: 'your-collection'
    }]
  ],
});
```

```javascript
// playwright.config.js
const {} = require('@playwright/test');

const config = {
  reporter: [
    ['playwright-mongodb-reporter', {
        credentials: {
            username: 'your name',
            password: 'your Password',
            host: 'localhost',
            port: '27017',
            authSource: 'admin'
          },
    }]
  ],
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        PROJECT_NAME: 'desktopChrome',
        screenshot: 'only-on-failure',
        browserName: 'chromium',
        viewport: { width: 1300, height: 800 }
      }
    }
  ],
};

module.exports = config;
```

```json
// package.json
{
  "scripts": {
    "test": "playwright test --config playwright.config.js"
  }
}
```

## Handling Common and Unique Titles

`playwright-mongodb-reporter` allows you to split your suite and test titles into common and unique parts using the `-|-` separator. This is especially useful when you have tests that share a common context but want to differentiate them without duplicating entries in your database.

### How It Works

When the reporter encounters a `-|-` in your suite or test titles, it splits the title into two parts:

-   Main Title: The portion before `-|-
-   Subtitle: The portion after -|-
These are then stored separately in your MongoDB collection, allowing for better organization and querying of your test results.

### Example Usage

Suppose you have a suite of tests for a blog application, and you want to differentiate tests based on user roles or other unique factors. Here's how you can use the `-|-` separator:

```typescript
// tests/blog.spec.ts
import { test } from '@playwright/test';

test.describe('Blog Tests -|- Admin User', () => {
  test('Create Post -|- With Valid Data', async ({ page }) => {
    // Test code for creating a post with valid data as an admin user
  });

  test('Delete Post -|- Existing Post', async ({ page }) => {
    // Test code for deleting an existing post as an admin user
  });
});

test.describe('Blog Tests -|- Guest User', () => {
  test('View Post -|- Published Post', async ({ page }) => {
    // Test code for viewing a published post as a guest user
  });

  test('Create Post -|- Should Fail', async ({ page }) => {
    // Test code to ensure guest users cannot create posts
  });
});
```
In the example above:

- Suite Titles:
  - Blog Tests -|- Admin User
    - suite_title: Blog Tests
    - suite_title_sub: Admin User
  - Blog Tests -|- Guest User
    - suite_title: Blog Tests
    - suite_title_sub: Guest User

- Test Case Titles:
  - Create Post -|- With Valid Data
    - test_case: Create Post
    - test_case_sub: With Valid Data
  - Delete Post -|- Existing Post
    - test_case: Delete Post 
    - test_case_sub: Existing Post
  - View Post -|- Published Post
    - test_case: View Post
    - test_case_sub: Published Post
  - Create Post -|- Should Fail
    - test_case: Create Post
    - test_case_sub: Should Fail

### Benefits

-   Avoiding Duplicates: By separating common and unique parts of titles, the reporter prevents duplication in your MongoDB collection. Tests with the same main title but different subtitles are stored distinctly.
-   Improved Querying: Splitting titles allows for more granular queries. You can filter results based on the main titles or the subtitles independently.
-   Flexibility: Developers can append environment-specific or scenario-specific details as subtitles without altering the core test titles.

### Data Storage in MongoDB

Each test result is stored with the following fields:

-   suite_title: The main suite title before -|-
-   suite_title_sub: The suite subtitle after -|- (if present)
-   test_case: The main test case title before -|-
-   test_case_sub: The test case subtitle after -|- (if present)
-   result: The test result status (passed, failed, etc.)
-   duration: Execution time of the test
-   timestamp: Date and time when the test was executed
-   retry: Number of retries attempted for the test
-   error: Error message, if any
-   Other relevant metadata

### Usage Tips

-   Consistent Separator: Ensure you use -|- consistently in your titles to enable correct splitting.
-   Optional Subtitles: If you don't include -|- in a title, the entire title is considered the main title, and the subtitle fields will be null.
-   Dynamic Titles: You can programmatically append subtitles based on variables like user roles, environments, or other configurations within your test code.

### Sample Configuration

Your playwright.config.ts does not need to include the -|-' separator in project names. Instead, focus on using `-|-` within your test code's suite and test titles.

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Other configurations */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Add more projects if needed
  ],
});
```

### Example with Dynamic Subtitles

If you need to include dynamic information in your titles, you can use variables:

```typescript
// tests/example.spec.ts
import { test } from '@playwright/test';

const userRoles = ['Admin', 'Guest'];
const dataSets = ['Valid Data', 'Invalid Data'];

for (const role of userRoles) {
  test.describe(`User Actions -|- ${role} User`, () => {
    for (const data of dataSets) {
      test(`Perform Action -|- ${data}`, async ({ page }) => {
        // Test code using role and data
      });
    }
  });
}
```

### Querying Your Test Results

With your data organized into main titles and subtitles, you can perform more precise queries in MongoDB. For example:

-   Find all tests related to "Blog Tests":
`  db.test_results.find({ suite_title: 'Blog Tests' });`
-   Find all tests performed by "Admin User":
`  db.test_results.find({ suite_title_sub: 'Admin User' });`
-   Find all "Create Post" tests with "Valid Data":
`  db.test_results.find({ test_case: 'Create Post', test_case_sub: 'Valid Data' });`

### Avoiding Duplicates

By using the -|-' separator and structuring your titles accordingly, the reporter can identify when a test is logically the same but has unique aspects. This prevents duplication in your database and makes your test reporting cleaner.
For example, if you run the same test across different user roles or data sets, using subtitles allows each test result to be stored as a unique entry.

### Conclusion

Using the -|-' separator in your suite and test titles enhances the flexibility and organization of your test reporting. It allows you to maintain common titles for related tests while adding uniqueness where necessary, all without cluttering your database with duplicate entries.
