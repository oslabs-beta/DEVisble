/* eslint-disable @typescript-eslint/no-var-requires */
const supertest = require('supertest');
const { describe, it, beforeAll, expect, xdescribe } = require('@jest/globals');
const pg = require('pg');
// eslint-disable-next-line @typescript-eslint/naming-convention
const db_url = process.env.TEST_DATABASE_URL;

const server = 'http://localhost:3000';

const pool = new pg.Pool({
  connectionString: db_url,
});

// eslint-disable-next-line no-undef
jest.setTimeout(15000);

xdescribe('User functionality', () => {
  beforeAll(async () => {
    // wipe the database using pg manually
    // this is to be EXTRA SUPER DOUBLE CAREFUL that we don't accidently wipe the main db
    await pool.query('DELETE FROM "Build";');
    await pool.query('DELETE FROM "Repo";');
    await pool.query('DELETE FROM "User";');
  });

  describe('Registering a new user', () => {
    it('responds with a 200 status and creates a user', () => {
      const body = {
        username: 'test',
        plainPassword: 'test1',
        email: 'test@test.com',
      };
      return supertest(server)
        .post('/userAPI/signup')
        .send(body)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect((res) => {
          expect(res.body.username).toEqual('test');
          expect(res.body.id).toBeDefined();
        });
    });
    it('blocks a user being created with an existing username', () => {
      const body = {
        username: 'test',
        plainPassword: 'test1',
        email: 'test@test.com',
      };
      return supertest(server).post('/userAPI/signup').send(body).expect(409);
    });
    it('does not create a user if no username is provided', () => {
      return supertest(server)
        .post('/userAPI/signup')
        .send({ plainPassword: 'hellothere1', email: 'null@null.com' })
        .expect(400);
    });
    it('does not create a user if no password is provided', () => {
      return supertest(server)
        .post('/userAPI/signup')
        .send({ username: 'bob', email: 'null@null.com' })
        .expect(400);
    });
    it('does not create a user if no email is provided', () => {
      return supertest(server)
        .post('/userAPI/signup')
        .send({ username: 'bob', plainPassword: 'hunter2' })
        .expect(400);
    });
  });

  describe('Login functionality', () => {
    it('responds with a 200 status and logs in a user', () => {
      const body = {
        email: 'test@test.com',
        plainPassword: 'test1',
      };
      return supertest(server)
        .post('/userAPI/login')
        .send(body)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect('Set-Cookie', /access_token/);
    });
    it('responds with a 401 status if the username is incorrect', () => {
      const body = {
        email: 'a@test.com',
        plainPassword: 'test1',
      };
      return supertest(server).post('/userAPI/login').send(body).expect(401);
    });
    it('responds with a 401 status if the password is incorrect', () => {
      const body = {
        email: 'test@test.com',
        plainPassword: 'test2',
      };
      return supertest(server).post('/userAPI/login').send(body).expect(401);
    });
  });

  describe('Logout functionality', () => {
    it('responds with a 204 status and logs out a user', () => {
      return supertest(server)
        .delete('/userAPI/login')
        .expect(204)
        .expect(
          // it clears the cookie
          'Set-Cookie',
          /access_token=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT/
        );
    });
  });

  describe('GET cookie user functionality', () => {
    const agent = supertest.agent(server);
    const body = {
      email: 'test@test.com',
      plainPassword: 'test1',
    };
    beforeAll(async () => {
      await agent.post('/userAPI/login').send(body);
    });
    it("reads back the user's username and id when invoked with a valid cookie", () => {
      return agent
        .get('/userAPI/login')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.username).toBe('test');
        });
    });
    it('responds with a 401 status if the cookie is invalid', () => {
      return supertest(server).get('/userAPI/login').expect(401);
    });
  });

  describe('API Token functionality', () => {
    const agent = supertest.agent(server);
    const body = {
      email: 'test@test.com',
      plainPassword: 'test1',
    };
    beforeAll(async () => {
      await agent.post('/userAPI/login').send(body);
    });
    it("responds with the user's API token if requested with a valid cookie", () => {
      return agent.get('/userAPI/getToken').expect(200);
    });
    it('responds with a 403 status when not logged in', () => {
      return supertest(server).get('/userAPI/getToken').expect(403);
    });
  });
});

describe('App functionality', () => {
  let apiToken;
  const agent = supertest.agent(server);
  const body = {
    username: 'test',
    plainPassword: 'test1',
    email: 'test@test.com',
  };
  beforeAll(async () => {
    await pool.query('DELETE FROM "Build";');
    await pool.query('DELETE FROM "Repo";');
    await pool.query('DELETE FROM "User";');
    await agent.post('/userAPI/signup').send(body);
    const res = await agent.get('/userAPI/getToken');
    apiToken = res.body;
  });
  it('creates a new repo when invoked with a valid api token and a new repo name', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 1000,
      buildSize: 2000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D4',
    };
    return supertest(server)
      .post('/app')
      .send(appBody)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual('New repo test-repo was created in database');
      });
  });
  it('adds a new build when invoked with a valid api token and an existing repo name', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server)
      .post('/app')
      .send(appBody)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual(
          'Repo test-repo was updated with a new build (hash: A1B2C3D5)'
        );
      });
  });
  it("adds a new repo (not a build) when invoked with another user's account and an existing repo name", async () => {
    const newCreds = {
      username: 'test2',
      plainPassword: 'test1',
      email: 'test2@test.com',
    };
    await agent.post('/userAPI/signup').send(newCreds);
    const signupRes = await agent.get('/userAPI/getToken');
    const secondToken = signupRes.body;
    const appBody = {
      apiKey: secondToken,
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server)
      .post('/app')
      .send(appBody)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual('New repo test-repo was created in database');
      });
  });

  it('responds with a 401 status if the api token is invalid', () => {
    const appBody = {
      apiKey: 'invalid',
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(401);
  });

  it('responds with a 400 status if the repo name is not included', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      buildSize: 3000,
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });

  it('responds with a 400 status if the commit hash is not included', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: '',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });

  it('responds with a 400 status if the dependencies are not included', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });

  it('responds with a 400 status if the dependencies are not an array', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: {
        name: 'testdep',
        version: '0.0.1',
        isDevDependency: true,
      },
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });

  it('responds with a 400 status if a build time is not included', () => {
    const appBody = {
      apiKey: apiToken,
      buildSize: 3000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });

  it('responds with a 400 status if a build size is not included', () => {
    const appBody = {
      apiKey: apiToken,
      buildTime: 2000,
      repoName: 'test-repo',
      dependencies: [
        { name: 'testdep', version: '0.0.1', isDevDependency: true },
        { name: 'testdep2', version: '0.0.2', isDevDependency: false },
      ],
      commitHash: 'A1B2C3D5',
    };
    return supertest(server).post('/app').send(appBody).expect(400);
  });
});
