# Vulcan ORM
> MySQL, PostgreSQL & SQLite3 ORM for Vulcan MVC Framework

**This library is still a heavy work in progress. Some code is based on [Knex-ORM](https://github.com/kripod/knex-orm).**

## Usage

To get started you need to create a connection instance. This is a singleton object used by all models to make passing connections from one instance to another easier.

```js
import co from 'co'
import { createInstance, Model } from '@vulcan/orm'

createInstance({
  driver: 'sqlite',
  connection: {
    filename: 'path/to/sqlite.db'
  }
})

class User extends Model {
  static fillable = ['name', 'email']
}

co(function * () {
  const user = yield User.create({ name: 'Josh', email: 'josh@joshmanders.com' })
  console.log(user)
})
.catch((err) => console.error(err.stack))

```
