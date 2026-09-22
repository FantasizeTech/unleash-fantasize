import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestConfig } from '../../../test/config/test-config.js';
import { createFakeProjectService } from './createProjectService.js';
import FantasizeProjectController from './fantasize-project-controller.js';
import ProjectController from './project-controller.js';
import { CREATE_PROJECT, UPDATE_PROJECT, RoleName, TEST_AUDIT_USER } from '../../types/index.js';
import type { IUnleashServices } from '../../services/index.js';

const user = { id: 7, permissions: [], isAPI: false };
let app: express.Express;
let fixture: ReturnType<typeof createFakeProjectService>;
let allowed: boolean;
let permissions: string[];
let transaction: ReturnType<typeof vi.fn>;

beforeEach(async () => {
    const config = createTestConfig({ isEnterprise: false });
    fixture = createFakeProjectService(config);
    await fixture.accessService.createRole({ name: RoleName.OWNER, description: 'Owner', createdByUserId: 7 }, TEST_AUDIT_USER);
    allowed = true;
    permissions = [];
    transaction = vi.fn(async (fn) => fn(fixture.projectService));
    const service = Object.assign(fixture.projectService, { transactional: transaction });
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        Object.assign(req, { user, audit: TEST_AUDIT_USER,
            checkRbac: async (requested: string[]) => { permissions = requested; return allowed; } });
        next();
    });
    app.use('/projects', new FantasizeProjectController(config, { transactionalProjectService: service } as IUnleashServices).router);
});

test('creates multiple OSS projects, generated IDs and owner roles', async () => {
    const first = await request(app).post('/projects').send({ name: 'FantasizeTech' }).expect(201);
    const second = await request(app).post('/projects').send({ name: 'eDoc' }).expect(201);
    expect(first.body.id).toBe('fantasizetech');
    expect(second.body.id).toBe('edoc');
    expect(await fixture.projectStore.get('fantasizetech')).toMatchObject({ name: 'FantasizeTech' });
    expect(permissions).toEqual([CREATE_PROJECT]);
    expect(transaction).toHaveBeenCalledTimes(2);
});

test('viewer cannot create or update projects', async () => {
    allowed = false;
    await request(app).post('/projects').send({ name: 'Denied' }).expect(403);
    await request(app).put('/projects/default').send({ name: 'Denied' }).expect(403);
    expect(permissions).toEqual([UPDATE_PROJECT]);
    expect(transaction).not.toHaveBeenCalled();
});

test.each([{ name: ' ' }, { name: '<script>bad</script>' }, { name: 'Bad', id: '../bad' }, { name: 'Bad', mode: 'private' }, { name: 'Bad', featureLimit: -1 }, { name: 'Bad', environments: [] }, { name: 'Bad', extra: true }])('rejects invalid input %j without writes', async (body) => {
    await request(app).post('/projects').send(body).expect(400);
    expect(transaction).not.toHaveBeenCalled();
});

test('rejects missing environments and duplicate explicit ids', async () => {
    await request(app).post('/projects').send({ name: 'Missing', environments: ['nonexistent'] }).expect(400);
    await request(app).post('/projects').send({ name: 'One', id: 'same' }).expect(201);
    await request(app).post('/projects').send({ name: 'Two', id: 'same' }).expect(409);
});

test('validates project IDs for the create form', async () => {
    await request(app).post('/projects/validate').send({ id: 'valid-id' }).expect(200, { valid: true });
    await request(app).post('/projects/validate').send({}).expect(400);
    await request(app).post('/projects').send({ name: 'Taken', id: 'taken' }).expect(201);
    await request(app).post('/projects/validate').send({ id: 'taken' }).expect(409);
});

test('updates project settings but cannot switch the authorized project id', async () => {
    await request(app).post('/projects').send({ name: 'One', id: 'one' }).expect(201);
    await request(app).put('/projects/one').send({ id: 'other', name: 'Attack' }).expect(400);
    await request(app).put('/projects/one').send({ name: 'Renamed', description: 'Updated' }).expect(200);
    expect(await fixture.projectStore.get('one')).toMatchObject({ name: 'Renamed', description: 'Updated' });
    await request(app).put('/projects/missing').send({ name: 'Missing' }).expect(404);
});

describe('project listing', () => {
    test.each([undefined, 'true'])('lists accessible projects, including non-default projects (archived=%s)', async (archived) => {
        const projects = [{ id: 'default' }, { id: 'fantasizetech' }];
        const getProjects = vi.fn().mockResolvedValue(projects);
        const respondWithValidation = vi.fn();
        await ProjectController.prototype.getProjects.call({
            projectService: { getProjects, addOwnersToProjects: async (p: unknown) => p },
            openApiService: { respondWithValidation },
        } as unknown as ProjectController, { user, query: { archived } } as never, {} as never);
        expect(getProjects).toHaveBeenCalledWith({ archived: archived === 'true' }, 7);
        expect(respondWithValidation.mock.calls[0][3].projects).toEqual(projects);
    });
});
