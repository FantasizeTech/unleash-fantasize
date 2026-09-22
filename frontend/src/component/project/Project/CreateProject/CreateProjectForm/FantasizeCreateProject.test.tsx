import { expect, test } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from 'utils/testRenderer';
import { testServerRoute, testServerSetup } from 'utils/testServer';
import { CreateProjectDialog } from './CreateProjectDialog.tsx';
import { LegacyCreateProjectDialog } from './LegacyCreateProjectDialog.tsx';
import { CREATE_PROJECT } from 'component/providers/AccessProvider/permissions';

const server = testServerSetup();

test.each([
    ['current', CreateProjectDialog],
    ['legacy', LegacyCreateProjectDialog],
])('%s dialog submits an OSS-compatible project', async (name, Dialog) => {
    testServerRoute(server, '/api/admin/ui-config', {
        resourceLimits: { projects: 500 },
        versionInfo: { current: { oss: '8.2.0' } },
    });
    testServerRoute(server, '/api/admin/projects', {
        projects: [{ id: 'default', name: 'Default' }],
    });
    testServerRoute(server, '/api/admin/environments', { environments: [] });
    const { requests } = testServerRoute(
        server,
        '/api/admin/projects',
        { id: 'fantasizetech' },
        'post',
        201,
    );
    render(<Dialog open={true} onClose={() => {}} />, {
        permissions: [{ permission: CREATE_PROJECT }],
    });
    const nameInput =
        name === 'current'
            ? within(
                  await screen.findByTestId('PROJECT_FORM_NAME_INPUT'),
              ).getByRole('textbox')
            : await screen.findByRole('textbox', { name: /project name/i });
    fireEvent.change(nameInput, {
        target: { value: 'FantasizeTech' },
    });
    const submit = await screen.findByRole('button', {
        name: 'Create project',
    });
    await waitFor(() =>
        expect(submit).not.toHaveAttribute('aria-disabled', 'true'),
    );
    fireEvent.click(submit);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
        name: 'FantasizeTech',
        description: '',
        defaultStickiness: 'default',
    });
});
