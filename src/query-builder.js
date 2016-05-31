import { isArray, isObject } from 'lodash'
import DefaultMethods from 'knex/lib/query/methods'
import { ModelNotFoundError } from '@vulcan/errors'
import { getInstance } from '.'

const ignoredMethods = ['from', 'fromJS', 'into', 'table', 'queryBuilder']
const allowedMethods = DefaultMethods.filter((method) => !~ignoredMethods.indexOf(method))

export default class QueryBuilder {
  setModel (Model) {
    this.$Model = Model
    this.table(this.$Model.table)
    return this
  }

  $toModel (res) {
    if (!this.$Model) {
      return res
    }

    if (isArray(res)) {
      return res.map((r) => this.$toModel(r))
    }

    return isObject(res) ? new this.$Model(res, false) : res
  }

  table (tableName) {
    this.$db = getInstance().$db.from(tableName)
    return this
  }

  toString () {
    return this.$db.toString()
  }

  then (...args) {
    return this.$db
      .then((data) => {
        if (!data && this.$Model) {
          throw new ModelNotFoundError(this.$Model.name)
        }
        return this.$toModel(data)
      })
      .then(...args)
  }
}

for (const method of allowedMethods) {
  QueryBuilder.prototype[method] = function queryProxyMethod (...args) {
    this.$db = this.$db[method].apply(this.$db, args)
    return this
  }
}
