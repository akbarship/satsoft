'use strict';
/*
 * Tiny JSON-file database.
 *
 *   data/db.json
 *   {
 *     "operators": [ { "login", "salt", "hash", "createdAt" } ],
 *     "students":  [ { "id", "name", "createdAt", "lastStart": {code, at}, "results": [ ... ] } ]
 *   }
 *
 * Everything is kept in memory and written atomically (temp file + rename)
 * after every change, so a crash mid-write can never corrupt the file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EMPTY = () => ({ operators: [], students: [] });

class JsonDB {
  constructor(file) {
    this.file = file;
    this.data = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { ...EMPTY(), ...parsed };
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Keep the unreadable file for inspection instead of silently overwriting it.
        const backup = `${this.file}.corrupt-${Date.now()}`;
        fs.copyFileSync(this.file, backup);
        console.error(`db.json could not be parsed (${e.message}). Backed up to ${backup}.`);
      }
      return EMPTY();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  /* ----------------------------- students ----------------------------- */

  listStudents() {
    return this.data.students.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  getStudent(id) {
    return this.data.students.find((s) => s.id === String(id)) || null;
  }

  /** Random unused 4-digit id (falls back to 5+ digits if 4-digit space is crowded). */
  freeId() {
    for (let digits = 4; digits <= 8; digits++) {
      for (let i = 0; i < 200; i++) {
        const id = String(crypto.randomInt(10 ** (digits - 1), 10 ** digits));
        if (!this.getStudent(id)) return id;
      }
    }
    throw new Error('No free id');
  }

  addStudent({ id, name }) {
    const student = { id: id || this.freeId(), name, createdAt: new Date().toISOString(), lastStart: null, results: [] };
    this.data.students.push(student);
    this.save();
    return student;
  }

  updateStudent(id, patch) {
    const s = this.getStudent(id);
    if (!s) return null;
    Object.assign(s, patch);
    this.save();
    return s;
  }

  deleteStudent(id) {
    const before = this.data.students.length;
    this.data.students = this.data.students.filter((s) => s.id !== String(id));
    if (this.data.students.length !== before) this.save();
    return this.data.students.length !== before;
  }

  /* ----------------------------- operators ---------------------------- */

  static hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return { salt, hash };
  }

  setOperator(login, password) {
    const { salt, hash } = JsonDB.hashPassword(password);
    const existing = this.data.operators.find((o) => o.login === login);
    if (existing) Object.assign(existing, { salt, hash });
    else this.data.operators.push({ login, salt, hash, createdAt: new Date().toISOString() });
    this.save();
  }

  verifyOperator(login, password) {
    const op = this.data.operators.find((o) => o.login === String(login));
    // Hash even when the login is unknown so response time doesn't reveal valid logins.
    const { hash } = JsonDB.hashPassword(password, op ? op.salt : 'x'.repeat(32));
    if (!op) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(op.hash, 'hex'));
  }
}

module.exports = { JsonDB };
