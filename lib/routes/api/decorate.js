const assert = require('assert');
const sysError = require('./error');

module.exports = decorate;

const decorators = {
  'list': list,
  'add': add,
  'retrieve': retrieve,
  'update': update,
  'delete': remove
};

function decorate(router, klass, methods, preconditions) {
  const decs = methods && Array.isArray(methods) && methods[0] !== '*' ? methods : Object.keys(decorators);
  decs.forEach((m) => {
    assert(m in decorators);
    decorators[m](router, klass, preconditions);
  });
}

function list(router, klass) {
  router.get('/', async(req, res) => {
    const logger = req.app.locals.logger;
    //logger.info(`user: ${JSON.stringify(req.user)}`);
    //logger.info(`scope: ${JSON.stringify(req.authInfo.scope)}`);
    try {
      const results = await klass.retrieveAll();
      res.status(200).json(results);
    } catch (err) {
      sysError(logger, res, err);
    }
  });
}

function add(router, klass, preconditions) {
  router.post('/', async(req, res) => {
    const logger = req.app.locals.logger;
    try {
      if ('add' in preconditions) {
        assert(typeof preconditions.add === 'function');
        await preconditions.add(req);
      }
      const uuid = await klass.make(req.body);
      res.status(201).json({sid: uuid});
    } catch (err) {
      sysError(logger, res, err);
    }
  });
}

function retrieve(router, klass) {
  router.get('/:sid', async(req, res) => {
    const logger = req.app.locals.logger;
    try {
      const results = await klass.retrieve(req.params.sid);
      if (results.length === 0) return res.status(404).end();
      return res.status(200).json(results[0]);
    }
    catch (err) {
      sysError(logger, res, err);
    }
  });
}

function update(router, klass) {
  router.put('/:sid', async(req, res) => {
    const sid = req.params.sid;
    const logger = req.app.locals.logger;
    try {
      const rowsAffected = await klass.update(sid, req.body);
      if (rowsAffected === 0) {
        return res.status(404).end();
      }
      res.status(204).end();
    } catch (err) {
      sysError(logger, res, err);
    }
  });
}

function remove(router, klass, preconditions) {
  router.delete('/:sid', async(req, res) => {
    const sid = req.params.sid;
    const logger = req.app.locals.logger;
    try {
      if ('delete' in preconditions) {
        assert(typeof preconditions.delete === 'function');
        await preconditions.delete(req, sid);
      }
      const rowsAffected = await klass.remove(sid);
      if (rowsAffected === 0) {
        logger.info(`unable to delete ${klass.name} with sid ${sid}: not found`);
        return res.status(404).end();
      }
      res.status(204).end();
    } catch (err) {
      sysError(logger, res, err);
    }
  });
}
