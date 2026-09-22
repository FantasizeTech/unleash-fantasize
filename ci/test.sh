#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/jenkins/tools/node/bin:/home/jenkins/tools/pnpm-11.15.1/node_modules/.bin:$PATH"
if ! test -x /home/jenkins/tools/pnpm-11.15.1/node_modules/.bin/pnpm; then npm install --prefix /home/jenkins/tools/pnpm-11.15.1 --ignore-scripts pnpm@11.15.1; fi
export CYPRESS_INSTALL_BINARY=0 HUSKY=0
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec biome check --write src/lib/features/project/fantasize-project-controller.ts src/lib/features/project/fantasize-project-controller.test.ts frontend/src/component/project/ProjectList/ProjectCreationButton/ProjectCreationButton.tsx frontend/src/component/project/ProjectList/ProjectList.test.tsx vitest.fantasize.config.ts
pnpm exec vitest run --config vitest.fantasize.config.ts --coverage
pnpm --dir frontend exec vitest run src/component/project/ProjectList/ProjectList.test.tsx src/component/project/Project/CreateProject/CreateProjectForm/LegacyCreateProjectDialog.test.tsx --maxWorkers=1 --coverage --coverage.reporter=lcov --coverage.reportsDirectory=../coverage/frontend
cat coverage/frontend/lcov.info >> coverage/lcov.info
pnpm run build:backend
pnpm --dir frontend run ts:check
