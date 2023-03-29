class BadRequestError extends Error {
  constructor(msg) {
    super(msg);
  }
}

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
  BadRequestError,
  DbError,
  DbErrorBadRequest,
  DbErrorUnprocessableRequest,
  DbErrorForbidden
};
