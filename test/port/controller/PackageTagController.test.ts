import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/PackageTagController.test.ts', () => {
  let publisher;
  let ctx: Context;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /-/package/:fullname/dist-tags] showTags()', () => {
    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/not-exists/dist-tags')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] not-exists not found');
    });

    it('should get package tags', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);

      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/dist-tags`)
        .expect(200);
      assert.equal(res.body.latest, '1.0.0');
      assert.deepEqual(Object.keys(res.body), [ 'latest' ]);
    });
  });

  describe('[PUT /-/package/:fullname/dist-tags/:tag] saveTag()', () => {
    it('should 401 when readonly token', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const userReadonly = await TestUtil.createTokenByUser({
        password: publisher.password,
        token: publisher.token,
        readonly: true,
      });
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', userReadonly.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token/);
    });

    it('should 403 when non-maintainer add tag', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const other = await TestUtil.createUser();
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', other.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${other.name}" not authorized to modify @cnpm/koa, please contact maintainers: "${publisher.name}"`);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('199.0.0'))
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/koa@199.0.0 not found');
    });

    it('should 422 when version invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify(''))
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] version("") format invalid');
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('wrong.ver.1'))
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] version("wrong.ver.1") format invalid');
    });

    it('should 422 when tag invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/111`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Tag name must not be a valid SemVer range: "111"');
    });

    it('should 200', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        beta: '1.0.0',
      });
      // save tag and version ignore
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        beta: '1.0.0',
      });
    });

    it('should 200 on automation token', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const userAutomation = await TestUtil.createTokenByUser({
        password: publisher.password,
        token: publisher.token,
        automation: true,
      });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/automation`)
        .set('authorization', userAutomation.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        automation: '1.0.0',
      });
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/latest-3`)
        .set('authorization', userAutomation.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        'latest-3': '1.0.0',
        automation: '1.0.0',
      });
    });
  });

  describe('[DELETE /-/package/:fullname/dist-tags/:tag] removeTag()', () => {
    it('should 401 when readonly token', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const userReadonly = await TestUtil.createTokenByUser({
        password: publisher.password,
        token: publisher.token,
        readonly: true,
      });
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', userReadonly.authorization)
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token/);
    });

    it('should 403 when non-maintainer add tag', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const other = await TestUtil.createUser();
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', other.authorization)
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${other.name}" not authorized to modify @cnpm/koa, please contact maintainers: "${publisher.name}"`);
    });

    it('should 200 when tag not exists', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .expect(200);
      assert.equal(res.body.ok, true);
    });

    it('should 422 when tag invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/1.0`)
        .set('authorization', publisher.authorization)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Tag name must not be a valid SemVer range: "1.0"');
    });

    it('should 422 when tag is latest', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/latest`)
        .set('authorization', publisher.authorization)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Can\'t remove the "latest" tag');
    });

    it('should 200', async () => {
      let pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '2.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta: '1.0.0',
      });

      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/${encodeURIComponent(' beta2 ')}`)
        .set('authorization', publisher.authorization)
        .set('content-type', 'application/json')
        .send(JSON.stringify('2.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta: '1.0.0',
        beta2: '2.0.0',
      });

      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta2: '2.0.0',
      });
    });
  });
});
