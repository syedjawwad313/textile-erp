import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { prisma } from '@textile-erp/database';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create DB State
    const tenant = await prisma.tenant.create({ data: { name: 'Auth Test Tenant' } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/auth/register (POST) - Valid User', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        tenantId,
        email: 'test@auth.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('/auth/register (POST) - Duplicate User', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        tenantId,
        email: 'test@auth.com',
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User'
      });
      
    expect(res.status).toBe(409); // Conflict
  });

  it('/auth/login (POST) - Valid Credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        tenantId,
        email: 'test@auth.com',
        password: 'Password123!'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('/auth/login (POST) - Invalid Password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        tenantId,
        email: 'test@auth.com',
        password: 'WrongPassword'
      });
      
    expect(res.status).toBe(401);
  });

  it('/auth/me (GET) - Valid Token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@auth.com');
  });

  it('/auth/me (GET) - Without Token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me');
      
    expect(res.status).toBe(401);
  });

  it('/auth/refresh (POST) - Valid Refresh Token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });
      
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('/auth/refresh (POST) - Invalid Refresh Token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' });
      
    expect(res.status).toBe(401);
  });
});
