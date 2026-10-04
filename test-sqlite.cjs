const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS test (id INT, name TEXT)");
  db.run("INSERT INTO test VALUES (1, 'SQLite Verification Test')");
  db.each("SELECT id, name FROM test", (err, row) => {
    console.log(row.id + ": " + row.name);
  });
});
db.close();
