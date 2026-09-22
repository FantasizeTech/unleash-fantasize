import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/lib/features/project/fantasize-project-controller.test.ts', 'src/lib/features/project/project-service.test.ts'],
        setupFiles: ['./src/test/errorWithMessage.ts', './src/test/reset-cross-file-state.ts'],
        maxWorkers: 1,
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov', 'json-summary'],
            include: ['src/lib/features/project/fantasize-project-controller.ts', 'src/lib/features/project/project-controller.ts', 'src/lib/features/project/project-service.ts'],
            reportsDirectory: 'coverage',
        },
    },
});
