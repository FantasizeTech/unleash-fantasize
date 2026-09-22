// Fantasize Technology modification, 2026-09-22. AGPL-3.0-or-later.
import type { Response } from 'express';
import Joi from 'joi';
import Controller from '../../routes/controller.js';
import type { IAuthRequest } from '../../routes/unleash-types.js';
import type { IUnleashConfig } from '../../types/option.js';
import type { IUnleashServices } from '../../services/index.js';
import {
    CREATE_PROJECT,
    UPDATE_PROJECT,
    DELETE_PROJECT,
    MOVE_FEATURE_TOGGLE,
} from '../../types/permissions.js';
import { projectSchema } from '../../services/project-schema.js';
import InvalidOperationError from '../../error/invalid-operation-error.js';
import { nameType } from '../../routes/util.js';

// Only OSS fields are accepted. Enterprise modes and workflows remain unavailable.
const inputSchema = projectSchema
    .fork(['id'], (schema) => schema.optional())
    .fork(['name'], (schema) => schema.trim().min(1).max(255))
    .fork(['mode', 'changeRequestEnvironments', 'featureNaming'], (schema) =>
        schema.forbidden(),
    )
    .fork(['featureLimit'], () => Joi.number().integer().min(0).allow(null))
    .fork(['environments'], (schema) => schema.min(1).unique())
    .options({ stripUnknown: false, allowUnknown: false });

export default class FantasizeProjectController extends Controller {
    private readonly projects: IUnleashServices['transactionalProjectService'];

    constructor(
        config: IUnleashConfig,
        services: Pick<IUnleashServices, 'transactionalProjectService'>,
    ) {
        super(config);
        this.projects = services.transactionalProjectService;
        this.route({
            path: '',
            method: 'post',
            permission: CREATE_PROJECT,
            handler: this.create,
        });
        this.route({
            path: '/validate',
            method: 'post',
            permission: CREATE_PROJECT,
            handler: this.validate,
        });
        this.route({
            path: '/:projectId',
            method: 'put',
            permission: UPDATE_PROJECT,
            handler: this.update,
        });
        this.route({
            path: '/archive/:projectId',
            method: 'post',
            permission: DELETE_PROJECT,
            handler: this.archive,
            acceptAnyContentType: true,
        });
        this.route({
            path: '/revive/:projectId',
            method: 'post',
            permission: CREATE_PROJECT,
            handler: this.revive,
            acceptAnyContentType: true,
        });
        this.route({
            path: '/:projectId',
            method: 'delete',
            permission: DELETE_PROJECT,
            handler: this.remove,
            acceptAnyContentType: true,
        });
        this.route({
            path: '/:projectId/features/:featureName/changeProject',
            method: 'post',
            permission: MOVE_FEATURE_TOGGLE,
            handler: this.moveFeature,
        });
    }

    async create(req: IAuthRequest, res: Response): Promise<void> {
        const data = await inputSchema.validateAsync(req.body);
        const project = await this.projects.transactional((service) =>
            service.createProject(data, req.user, req.audit),
        );
        res.status(201).json(project);
    }

    async validate(req: IAuthRequest, res: Response): Promise<void> {
        const { id } = await Joi.object({
            id: nameType.required(),
        }).validateAsync(req.body);
        await this.projects.validateId(id);
        res.status(200).json({ valid: true });
    }

    async update(
        req: IAuthRequest<{ projectId: string }>,
        res: Response,
    ): Promise<void> {
        const data = await inputSchema
            .fork(['environments'], (schema) => schema.forbidden())
            .validateAsync(req.body);
        // Path is the authorization boundary; a body id may not target another project.
        await Joi.valid(req.params.projectId).validateAsync(
            data.id ?? req.params.projectId,
        );
        await this.projects.transactional(async (service) => {
            await service.getProject(req.params.projectId);
            await service.updateProject(
                { ...data, id: req.params.projectId },
                req.audit,
            );
        });
        res.status(200).end();
    }
    async archive(req: IAuthRequest, res: Response): Promise<void> {
        if (req.params.projectId === 'default') {
            throw new InvalidOperationError(
                'The default project cannot be archived',
            );
        }
        await this.projects.transactional(async (service) => {
            await service.getProject(req.params.projectId);
            await service.archiveProject(req.params.projectId, req.audit);
        });
        res.status(200).end();
    }

    async revive(req: IAuthRequest, res: Response): Promise<void> {
        await this.projects.transactional(async (service) => {
            await service.getProject(req.params.projectId);
            await service.reviveProject(req.params.projectId, req.audit);
        });
        res.status(200).end();
    }

    async remove(req: IAuthRequest, res: Response): Promise<void> {
        await this.projects.transactional(async (service) => {
            await service.getProject(req.params.projectId);
            await service.deleteProject(
                req.params.projectId,
                req.user,
                req.audit,
            );
        });
        res.status(200).end();
    }

    async moveFeature(req: IAuthRequest, res: Response): Promise<void> {
        const { newProjectId } = await Joi.object({
            newProjectId: nameType.required(),
        }).validateAsync(req.body);
        const feature = await this.projects.transactional((service) =>
            service.changeProject(
                newProjectId,
                req.params.featureName,
                req.user,
                req.params.projectId,
                req.audit,
            ),
        );
        res.status(200).json(feature);
    }
}
