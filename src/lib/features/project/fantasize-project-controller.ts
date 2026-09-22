// Fantasize Technology modification, 2026-09-22. AGPL-3.0-or-later.
import type { Response } from 'express';
import Joi from 'joi';
import Controller from '../../routes/controller.js';
import type { IAuthRequest } from '../../routes/unleash-types.js';
import type { IUnleashConfig } from '../../types/option.js';
import type { IUnleashServices } from '../../services/index.js';
import { CREATE_PROJECT, UPDATE_PROJECT } from '../../types/permissions.js';
import { projectSchema } from '../../services/project-schema.js';
import { nameType } from '../../routes/util.js';

// Only OSS fields are accepted. Enterprise modes and workflows remain unavailable.
const inputSchema = projectSchema
    .fork(['name'], (schema) => schema.trim().min(1).max(255))
    .fork(['mode', 'changeRequestEnvironments', 'featureNaming'], (schema) =>
        schema.forbidden(),
    )
    .fork(['featureLimit'], () => Joi.number().integer().min(0).allow(null))
    .fork(['environments'], (schema) => schema.min(1).unique())
    .options({ stripUnknown: false, allowUnknown: false });

export default class FantasizeProjectController extends Controller {
    private readonly projects: IUnleashServices['transactionalProjectService'];

    constructor(config: IUnleashConfig, services: IUnleashServices) {
        super(config);
        this.projects = services.transactionalProjectService;
        this.route({ path: '', method: 'post', permission: CREATE_PROJECT, handler: this.create });
        this.route({ path: '/validate', method: 'post', permission: CREATE_PROJECT, handler: this.validate });
        this.route({ path: '/:projectId', method: 'put', permission: UPDATE_PROJECT, handler: this.update });
    }

    async create(req: IAuthRequest, res: Response): Promise<void> {
        const data = await inputSchema.validateAsync(req.body);
        const project = await this.projects.transactional((service) =>
            service.createProject(data, req.user, req.audit),
        );
        res.status(201).json(project);
    }

    async validate(req: IAuthRequest, res: Response): Promise<void> {
        const { id } = await Joi.object({ id: nameType.required() }).validateAsync(req.body);
        await this.projects.validateId(id);
        res.status(200).json({ valid: true });
    }

    async update(req: IAuthRequest<{ projectId: string }>, res: Response): Promise<void> {
        const data = await inputSchema
            .fork(['environments'], (schema) => schema.forbidden())
            .validateAsync(req.body);
        // Path is the authorization boundary; a body id may not target another project.
        await Joi.valid(req.params.projectId).validateAsync(data.id ?? req.params.projectId);
        await this.projects.transactional(async (service) => {
            await service.getProject(req.params.projectId);
            await service.updateProject({ ...data, id: req.params.projectId }, req.audit);
        });
        res.status(200).end();
    }
}
