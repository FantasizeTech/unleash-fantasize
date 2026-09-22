import { expect, test } from 'vitest';
import { render } from 'utils/testRenderer';
import { ProjectList } from './ProjectList.tsx';
import { screen, waitFor } from '@testing-library/react';
import { testServerRoute, testServerSetup } from 'utils/testServer';
import { CREATE_PROJECT } from '../../providers/AccessProvider/permissions.ts';

const server = testServerSetup();

const setupApi = () => {
    testServerRoute(server, '/api/admin/ui-config', {
        resourceLimits: { projects: 1 },
        versionInfo: {
            current: { enterprise: 'version' },
        },
    });

    testServerRoute(server, '/api/admin/projects', {
        projects: [{ name: 'existing', id: '1' }],
    });
};

test('Enabled new project button when version and permission allow for it and limit is reached', async () => {
    setupApi();
    render(<ProjectList />, {
        permissions: [{ permission: CREATE_PROJECT }],
    });

    await waitFor(async () => {
        const button = await screen.findByText('New project');
        expect(button).not.toHaveAttribute('aria-disabled', 'true');
    });
});

test('OSS users with CREATE_PROJECT can open the create dialog', async () => {
    testServerRoute(server, '/api/admin/ui-config', {
        resourceLimits: { projects: 500 },
        versionInfo: { current: { oss: '8.2.0' } },
    });
    testServerRoute(server, '/api/admin/projects', {
        projects: [{ id: 'default', name: 'Default' }],
    });
    render(<ProjectList />, { permissions: [{ permission: CREATE_PROJECT }] });
    await waitFor(() =>
        expect(screen.getByText('New project')).not.toHaveAttribute(
            'aria-disabled',
            'true',
        ),
    );
    expect(screen.queryByAltText('Upgrade projects')).not.toBeInTheDocument();
});
