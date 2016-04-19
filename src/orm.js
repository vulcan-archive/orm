import { defaultsDeep } from 'lodash'
import knex from 'knex'
import { MissingConnectionError } from './errors'

const driverMappings = { sqlite: 'sqlite3', postgres: 'pg', mysql: 'mysql' }

export default class ORM {
  constructor ({ driver = 'sqlite', connection, pool, ...options } = {}) {
    if (!connection) {
      throw new MissingConnectionError()
    }
    this.$options = defaultsDeep({}, options, { convertCase: false, useNullAsDefault: true })
    this.$client = driverMappings[driver]
    this.$db = knex(defaultsDeep({}, { connection, pool }, {
      client: this.$client,
      useNullAsDefault: this.$options.useNullAsDefault
    }))
  }

  destroy (...args) {
    return this.$db.destroy(...args)
  }
}
