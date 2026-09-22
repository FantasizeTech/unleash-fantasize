import { useContext, type FC, type ReactNode } from 'react';
import type { ITooltipResolverProps } from 'component/common/TooltipResolver/TooltipResolver';
import AccessContext from 'contexts/AccessContext';
import ResponsiveButton from 'component/common/ResponsiveButton/ResponsiveButton';
import { CREATE_PROJECT } from 'component/providers/AccessProvider/permissions';
import Add from '@mui/icons-material/Add';
import { CreateProjectDialog } from '../../Project/CreateProject/CreateProjectForm/CreateProjectDialog.tsx';
import { LegacyCreateProjectDialog } from '../../Project/CreateProject/CreateProjectForm/LegacyCreateProjectDialog.tsx';
import useUiConfig from 'hooks/api/getters/useUiConfig/useUiConfig';
import { useUiFlag } from 'hooks/useUiFlag';

interface ICreateButtonData {
    disabled: boolean;
    tooltip?: Omit<ITooltipResolverProps, 'children'>;
    endIcon?: ReactNode;
}

const NAVIGATE_TO_CREATE_PROJECT = 'NAVIGATE_TO_CREATE_PROJECT';

function resolveCreateButtonData(
    hasAccess: boolean,
): ICreateButtonData {
    if (!hasAccess) {
        return {
            tooltip: {
                title: 'You do not have permission to create new projects',
            },
            disabled: true,
        };
    } else {
        return {
            tooltip: { title: 'Click to create a new project' },
            disabled: false,
        };
    }
}

type ProjectCreationButtonProps = {
    isDialogOpen: boolean;
    setIsDialogOpen: (value: boolean) => void;
};

export const ProjectCreationButton: FC<ProjectCreationButtonProps> = ({
    isDialogOpen,
    setIsDialogOpen,
}) => {
    const { hasAccess } = useContext(AccessContext);
    const { loading } = useUiConfig();
    const useNewDesign = useUiFlag('newModalDesign');

    const createButtonData = resolveCreateButtonData(
        hasAccess(CREATE_PROJECT),
    );

    return (
        <>
            <ResponsiveButton
                Icon={Add}
                endIcon={createButtonData.endIcon}
                onClick={() => setIsDialogOpen(true)}
                maxWidth='700px'
                permission={CREATE_PROJECT}
                disabled={createButtonData.disabled || loading}
                tooltipProps={createButtonData.tooltip}
                data-testid={NAVIGATE_TO_CREATE_PROJECT}
            >
                New project
            </ResponsiveButton>
            <a href="https://github.com/FantasizeTech/unleash-fantasize" target="_blank" rel="noopener noreferrer">Fantasize source (AGPL)</a>
            {useNewDesign ? (
                <CreateProjectDialog
                    open={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                />
            ) : (
                <LegacyCreateProjectDialog
                    open={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                />
            )}
        </>
    );
};
