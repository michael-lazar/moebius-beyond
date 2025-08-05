# Project Context

- This is a legacy electron codebase that has been forked several times and has had maintainers with various levels of javascript / electron experience.
- There is functional testing with playright. Test at the highest abstraction level possible and avoid mocking.
- There is linting and formatting with eslint and prettier.
- Manual application testing will be used to verify behavior and fixes.
- Follow existing project conventions when adding new features.
- Do not make large, sweeping changes that cannot be easily verified.
- DO NOT USE broad try..catch.. blocks to hide bugs. ALLOW UNHANDLED ERRORS TO PROPAGATE.
- AVOID _hacky_ patches that mock out functions or have other unintuitive side effects.
- When changes involve ICP messages, carefully consider the interaction between the main process and the renderer process.
- Add comments when it makes sense to do so, but do not comment trivial behavior.
- PRs should always be made against origin/main and never the upstream repo.
- Do not run builds (npm run build-mac) unless explicitly instructed to do so.
- When committing changes, the commit message should be a single sentence.
- AVOID inline require() unless necessary to avoid circular import errors.
- There is documentation on XBIN and SAUCE formats in the reference/ directory.
