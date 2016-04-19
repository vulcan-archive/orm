import { EventEmitter } from 'events'
import { tableize } from 'inflection'
import { defaults, isInteger, intersection } from 'lodash'
import QueryBuilder from './query-builder'
import { MassAssignmentError } from './errors'

export default class Model {
  static $table = false

  static $primaryKey = 'id'

  static $timestampKeys = ['created_at', 'updated_at']

  static $hasTimestamps = true

  static $fillable = []

  static $guarded = ['*']

  static $unguarded = false

  static $hidden = []

  static $visible = []

  static get table () {
    return this.$table ? this.$table : tableize(this.name)
  }

  static set table (table) {
    this.$table = table
  }

  static set primaryKey (primaryKey) {
    this.$primaryKey = primaryKey
  }

  static set timestamps (keys) {
    this.$hasTimestamps = Array.isArray(keys) && keys.length > 0
    this.$timestampKeys = keys
  }

  static set hasTimestamps (hasTimestamps) {
    this.$hasTimestamps = Boolean(hasTimestamps)
  }

  static set fillable (fillable) {
    this.$fillable = Array.isArray(fillable) ? fillable : [fillable]
  }

  static set guarded (guarded) {
    this.$guarded = Array.isArray(guarded) ? guarded : [guarded]
  }

  static set unguarded (unguarded) {
    this.$unguarded = Boolean(unguarded)
  }

  static query () {
    return new QueryBuilder(this)
  }

  static all () {
    return this.query()
  }

  static first () {
    return this.all().first()
  }

  static where (...args) {
    return this.all().where(...args)
  }

  static find (args) {
    if (isInteger(args)) {
      return this.where(this.$primaryKey, args).first()
    }
    return this.where(args).first()
  }

  static create (props = {}) {
    const model = new this(props)
    return model.save()
  }

  constructor (props = {}, fresh = true) {
    this.$original = fresh ? {} : defaults({}, props)
    this.$fresh = fresh
    this.$relations = {}
    this.$events = new EventEmitter()
    this.$events.setMaxListeners(0)
    this.fill(props)
  }

  fill (props) {
    this.$fillable(props).forEach((prop) => {
      console.log(prop, this.$isFillable(prop))
      if (this.$isFillable(prop)) {
        this[prop] = props[prop]
      } else if (this.$totallyGuarded()) {
        throw new MassAssignmentError(prop)
      }
    })
    return this
  }

  $fillable (props) {
    const fillable = this.constructor.$fillable
    const unguarded = this.constructor.$unguarded

    if (fillable.length > 0 && !unguarded) {
      return intersection(Object.keys(props), fillable)
    }
    return Object.keys(props)
  }

  $totallyGuarded () {
    if (this.constructor.$fillable.length === 0) {
      const $guarded = this.constructor.$guarded
      if ($guarded.length === 1 && $guarded[0] === '*') {
        return true
      }
    }
    return false
  }

  $isFillable (prop) {
    if (this.constructor.$unguarded) {
      return true
    }

    if (this.constructor.$fillable.indexOf(prop) > -1) {
      return true
    }

    if (this.$isGuarded(prop)) {
      return false
    }
  }

  $isGuarded (prop) {
    const $guarded = this.constructor.$guarded

    if ($guarded.indexOf(prop) > -1) {
      return true
    }

    if ($guarded.length > 0 && $guarded[0] === '*') {
      return true
    }
    return false
  }

  newQuery () {
    return this.constructor.query()
  }

  query () {
    const primaryKey = this.constructor.$primaryKey

    return this.newQuery()
      .where(primaryKey, this[primaryKey])
      .first()
  }

  on (...args) {
    return this.$emitter.on(...args)
  }

  emit (...args) {
    return this.$emitter.emit(...args)
  }

  once (...args) {
    return this.$emitter.once(...args)
  }

  save () {
    const changedOrNew = {}
    Object
      .getOwnPropertyNames(this)
      .filter((prop) => !prop.startsWith('$'))
      .filter((prop) => !(this.$original.hasOwnProperty(prop) && this.$original[prop] === this[prop]))
      .forEach((prop) => {
        changedOrNew[prop] = this[prop]
      })

    if (this.$fresh) {
      return this.$insert(changedOrNew)
    }
    return this.update(changedOrNew)
  }

  $insert (props) {
    const primaryKey = this.constructor.$primaryKey

    return this.newQuery()
      .insert(props, true)
      .then((res) => {
        this.$original = defaults({}, props, { [primaryKey]: res[0] })
        this[primaryKey] = res[0]
        return this
      })
  }

  update (props) {
    return this.query()
      .update(props)
      .then((res) => {
        this.$original = defaults({}, props, this.$original)
        Object.assign(this, props)
        return this
      })
  }
}
