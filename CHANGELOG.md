# Changelog

## [0.1.0] - 2024-03-14

### Added
- Initial release of playwright-mongodb-reporter
- MongoDB integration for Playwright test results
- Support for custom MongoDB URI and credentials
- Automatic test result storage with retry handling
- Connection error handling and reconnection attempts
- Support for test metadata including:
  - Browser group
  - Test group
  - Test store
  - Test page name
  - Test path
  - Duration
  - Status
  - Error messages
- TypeScript support
- Comprehensive test coverage
- GitHub Actions CI/CD pipeline
- NPM publishing workflow

### Dependencies
- Playwright Test ^1.49.1
- MongoDB ^6.12.0
- Node.js >=18.0.0