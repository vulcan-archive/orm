import { isArray, isObject } from 'lodash'
import DefaultMethods from 'knex/lib/query/methods'

const ignoredMethods = ['from', 'fromJS', 'into', 'table', 'queryBuilder']
const allowedMethods = DefaultMethods.filter((method) => !~ignoredMethods.indexOf(method))

export default class QueryBuilder {
  constructor (Model) {
    this.$Model = Model
    this.$db = this.$Model.$instance.$db.from(this.$Model.table)
  }

  $toModel (res) {
    if (isArray(res)) {
      return res.map((r) => this.$toModel(r))
    }

    return isObject(res) ? new this.$Model(res, false) : res
  }

  then (...args) {
    return this.$db
      .then((res) => this.$toModel(res))
      .then(...args)
  }
}

for (const method of allowedMethods) {
  QueryBuilder.prototype[method] = function queryProxyMethod (...args) {
    this.$db = this.$db[method].apply(this.$db, args)
    return this
  }
}
