export class ORMError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = this.constructor.name
    this.stack = (new Error(message)).stack
  }
}

export class MissingConnectionError extends ORMError {
  constructor (message = 'Connection object is missing.') {
    super(message)
  }
}

export class MassAssignmentError extends ORMError {
  constructor (key) {
    super(`Mass assignment error: ${key}`)
  }
}

export class ModelNotFoundError extends ORMError {
  constructor (model) {
    super(`No query results for model [${model}].`)
  }
}
