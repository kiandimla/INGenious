function createUserRepository(db) {
  const byName=db.prepare(`SELECT id,name,password_hash AS passwordHash,reset_key_hash AS resetKeyHash,is_admin AS isAdmin,is_active AS isActive FROM users WHERE name=? COLLATE NOCASE`);
  return {
    findByName:name=>byName.get(name),
    findById:id=>db.prepare(`SELECT id,name,is_admin AS isAdmin,is_active AS isActive,created_at AS createdAt,updated_at AS updatedAt FROM users WHERE id=?`).get(id),
    list:()=>db.prepare(`SELECT id,name,is_admin AS isAdmin,is_active AS isActive,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY name COLLATE NOCASE`).all(),
    create(value){const id=db.prepare(`INSERT INTO users(name,password_hash,reset_key_hash,is_admin,is_active) VALUES(@name,@passwordHash,@resetKeyHash,@isAdmin,1)`).run(value).lastInsertRowid;return this.findById(id)},
    deactivate:id=>db.prepare(`UPDATE users SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_active=1`).run(id),
    updatePassword(id,passwordHash){return db.prepare(`UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_active=1`).run(passwordHash,id)}
  };
}
module.exports={createUserRepository};
