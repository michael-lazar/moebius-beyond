# Project Context

- This is a legacy electron codebase that has been forked several times.
- There is some functional testing with playright.
- When adding tests, operate at the highest level possible and avoid mocking.
- There is linting and formatting with eslint and prettier.
- Manual smoke testing will be used to verify behavior and fixes.
- Follow existing project conventions when adding new features.
- Do not make large, sweeping changes that cannot be easily verified.
- DO NOT USE broad try..catch.. blocks to hide bugs. ALLOW UNHANDLED ERRORS TO PROPAGATE.
- AVOID _hacky_ patches that mock out functions or have other unintuitive side effects.
- When changes involve ICP messages, carefully consider the interaction between the main process and the renderer process.
- Add comments when it makes sense to do so, but do not comment trivial behavior.
- Do not run builds (npm run build-mac) unless explicitly instructed to do so.
- When committing changes, the commit message should be a single sentence.
- When updating the CHANGELOG.md, the message should be a single sentence.
- AVOID inline require() unless necessary to avoid circular import errors.
- There is documentation on ASCII/ANSI file formats in the reference/ directory.
