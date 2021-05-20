class DbError extends Error {
  constructor(msg) {
    super(msg);
  }
}

class DbErrorBadRequest extends DbError {
  constructor(msg) {
    super(msg);
  }
}

class DbErrorUnprocessableRequest extends DbError {
  constructor(msg) {
    super(msg);
  }
}

class DbErrorForbidden extends DbError {
  constructor(msg) {
    super(msg);
  }
}

module.exports = {
  DbError,
  DbErrorBadRequest,
  DbErrorUnprocessableRequest,
  DbErrorForbidden
};
