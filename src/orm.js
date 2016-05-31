import { defaultsDeep } from 'lodash'
import knex from 'knex'
import { MissingConnectionError } from '@vulcan/errors'
import QueryBuilder from './query-builder'

const driverMappings = { sqlite: 'sqlite3', postgres: 'pg', mysql: 'mysql' }

export default class ORM {
  constructor ({ driver = 'sqlite', connection, pool } = {}) {
    if (!connection) {
      throw new MissingConnectionError()
    }
    this.$options = defaultsDeep({}, { convertCase: false, useNullAsDefault: true })
    this.$client = driverMappings[driver]
    this.$db = knex(defaultsDeep({}, { connection, pool }, {
      client: this.$client,
      useNullAsDefault: this.$options.useNullAsDefault
    }))
  }

  query (tableName) {
    return (new QueryBuilder()).table(tableName)
  }

  destroy (...args) {
    return this.$db.destroy(...args)
  }
}
