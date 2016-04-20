import { EventEmitter } from 'events'
import { tableize } from 'inflection'
import { defaults, isInteger, intersection, omit, camelCase } from 'lodash'
import moment from 'moment'
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

  static set hidden (hidden) {
    this.$hidden = Array.isArray(hidden) ? hidden : [hidden]
  }

  static query () {
    return (new QueryBuilder()).setModel(this)
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
    this.$props = defaults({}, this.$original)
    this.$fresh = fresh
    this.$relations = {}
    this.$events = new EventEmitter()
    this.$events.setMaxListeners(0)
    this.setProps(this.$original)
    this.fill(props)
  }

  setProps (props) {
    for (const prop in props) {
      Object.defineProperty(this, prop, {
        configurable: true,
        enumerable: true,
        get: () => {
          if (this.constructor.$hasTimestamps && !!~this.constructor.$timestampKeys.indexOf(prop)) {
            return this.$morphGetter(prop, this.$props[prop])
          }
          return this.$props[prop]
        },
        set: (newVal) => {
          this.$props[prop] = this.$morphSetter(prop, newVal)
        }
      })
    }
    return this
  }

  fill (props) {
    this.$fillable(props).forEach((prop) => {
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
    if (!this.$fresh) {
      return false
    }

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

  $morphGetter (prop, value) {
    const getter = camelCase(`get_${prop}`)

    if (this.$isTimestampable(prop)) {
      value = moment(value)
    }

    if (this[getter]) {
      return this[getter](value)
    }

    return value
  }

  $morphSetter (prop, value) {
    const setter = camelCase(`set_${prop}`)

    if (this[setter]) {
      return this[setter](value)
    }

    return value
  }

  $isTimestampable (prop) {
    return this.constructor.$hasTimestamps && !!~this.constructor.$timestampKeys.indexOf(prop)
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
    Object.keys(this.$props)
      .filter((prop) => !this.$diff(prop))
      .forEach((prop) => {
        changedOrNew[prop] = this[prop]
      })
    Object.getOwnPropertyNames(this)
      .filter((prop) => !this.$diff(prop))
      .filter((prop) => !prop.startsWith('$'))
      .filter((prop) => !~Object.keys(changedOrNew).indexOf(prop))
      .forEach((prop) => {
        changedOrNew[prop] = this.$morphSetter(prop, this[prop])
      })
    if (this.$fresh) {
      return this.$insert(changedOrNew)
    }
    return this.update(changedOrNew)
  }

  $diff (prop) {
    return (this.$original.hasOwnProperty(prop) && this.$original[prop] === this.$props[prop])
  }

  $insert (props) {
    const primaryKey = this.constructor.$primaryKey
    const timestamps = this.constructor.$hasTimestamps ? {
      created_at: moment().toJSON(),
      updated_at: moment().toJSON()
    } : {}
    const fields = defaults({}, timestamps, props)

    return this.newQuery()
      .insert(fields, true)
      .then((res) => {
        this.$original = defaults({}, fields, { [primaryKey]: res[0] })
        this.setProps(this.$original)
        return this
      })
  }

  update (props) {
    const timestamps = this.constructor.$hasTimestamps ? {
      updated_at: moment().toJSON()
    } : {}
    const fields = defaults({}, timestamps, props)

    return this.query()
      .update(fields)
      .then((res) => {
        this.$original = defaults({}, fields, this.$original)
        this.setProps(this.$original)
        return this
      })
  }

  toJSON () {
    const props = omit(this.$props, this.constructor.$hidden)
    Object.keys(props)
      .forEach((prop) => {
        props[prop] = this.$morphGetter(prop, props[prop])
      })
    return props
  }
}
