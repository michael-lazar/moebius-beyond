# Project Context

- This is a legacy electron codebase that has been forked several times and has had maintainers with various levels of javascript / electron experience.
- There are no unit tests or automated linting.
- Manual application testing will be used to verify behavior and fixes.
- Follow existing project conventions when adding new features.
- Do not make large, sweeping changes that cannot be easily verified.
- Avoid *hacky* patches that mock out functions or have other unintuitive side effects.
- When changes involve ICP messages, carefully consider the interaction between the main process and the renderer process.
- Add comments when it makes sense to do so, but do not comment trivial behavior.