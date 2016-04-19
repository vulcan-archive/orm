import ORM from './orm'
import BaseModel from './model'
import { MissingConnectionError } from './errors'

let instance = false

export { ORM }

export const createInstance = (options) => {
  instance = new ORM(options)
  return instance
}

export const setInstance = (orm) => {
  if (!(orm instanceof ORM)) {
    throw new Error('An instance of ORM needs to be used.')
  }

  instance = orm
  return orm
}

export const getInstance = () => instance

export class Model extends BaseModel {
  static get $instance () {
    return instance
  }

  constructor (props, isNew) {
    super(props, isNew)
    if (!instance) {
      throw new MissingConnectionError('Connection instance is missing.')
    }
  }
}
