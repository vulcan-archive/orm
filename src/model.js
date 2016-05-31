import { EventEmitter } from 'events'
import Promise from 'bluebird'
import { tableize } from 'inflection'
import { defaults, isInteger, intersection, omit, camelCase } from 'lodash'
import moment from 'moment'
import { MassAssignmentError } from '@vulcan/errors'
import QueryBuilder from './query-builder'

const CREATED_AT = 'created_at'
const UPDATED_AT = 'updated_at'
const DELETED_AT = 'deleted_at'

export default class Model {

  static $table = false

  static $primaryKey = 'id'

  static $timestampKeys = [CREATED_AT, UPDATED_AT, DELETED_AT]

  static $hasTimestamps = true

  static $softDeletes = true

  static $withTrashed = false

  static $fillable = []

  static $guarded = ['*']

  static $unguarded = false

  static $hidden = []

  static $append = []

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

  static set softDeletes (softDeletes) {
    this.$softDeletes = Boolean(softDeletes)
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

  static set append (append) {
    this.$append = Array.isArray(append) ? append : [append]
  }

  static query () {
    const query = (new QueryBuilder()).setModel(this)
    if (this.$softDeletes && !this.$withTrashed) {
      return query.where({ [DELETED_AT]: null })
    }
    if (this.$withTrashed) {
      this.$withTrashed = false
    }
    return query
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
      return this.where(this.$primaryKey, Number(args)).first()
    }
    return this.where(args).first()
  }

  static withTrashed () {
    this.$withTrashed = true
    return this
  }

  static create (props = {}) {
    if (Array.isArray(props)) {
      return this.createMany(props)
    }
    const model = new this(props)
    return model.save()
  }

  static createMany (inserts = []) {
    return Promise.all(inserts.map((props) => this.create(props)))
  }

  constructor (props = {}, fresh = true) {
    this.$original = fresh ? {} : defaults({}, props)
    this.$props = defaults({}, this.$original)
    this.$fresh = fresh
    this.$events = new EventEmitter()
    this.$events.setMaxListeners(0)
    this.$setProps(this.$original)
    this.fill(props)
  }

  get props () {
    return this.$props
  }

  $setProps (props) {
    for (const prop in props) {
      Object.defineProperty(this, prop, {
        configurable: true,
        enumerable: true,
        get: () => this.$morphGetter(prop, this.$props[prop]),
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

    if (this.$isTimestampable(prop) && value !== null) {
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

  hasOne (...args) {
    return 'author'
    return new HasOne(this, ...args)
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
      [CREATED_AT]: moment().toJSON(),
      [UPDATED_AT]: moment().toJSON()
    } : {}
    const fields = defaults({}, timestamps, props)

    return this.newQuery()
      .insert(fields, primaryKey)
      .then((res) => {
        this.$original = defaults({}, fields, { [primaryKey]: res[0] })
        this.$props = defaults({}, this.$original)
        this.$setProps(this.$original)
        return this
      })
  }

  update (props) {
    const timestamps = this.constructor.$hasTimestamps ? {
      [UPDATED_AT]: moment().toJSON()
    } : {}
    const fields = defaults({}, timestamps, props)

    return this.query().first()
      .update(fields)
      .then((res) => {
        this.$original = defaults({}, fields, this.$original)
        this.$setProps(this.$original)
        return this
      })
  }

  destroy () {
    if (this.constructor.$softDeletes) {
      return this.update({ deleted_at: moment().toJSON() })
    }
    return this.query().first().del()
  }

  toJSON () {
    const props = omit(this.$props, this.constructor.$hidden)
    const appends = this.constructor.$append

    Object.keys(props)
      .forEach((prop) => {
        props[prop] = this.$morphGetter(prop, props[prop])
      })

    appends.forEach((prop) => {
      props[prop] = this[prop]
    })

    return props
  }
}
