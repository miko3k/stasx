"use strict"

var enc = require('./encryption.js')

var random = function(target) {
        window.crypto.getRandomValues(target)
}
var subtle = window.crypto.subtle

var encryptor = enc.createEncrpytor(subtle, random)

exports.code = enc.code
exports.generatePassword = function(len) {
    return enc.generatePassword(random, len)
}
exports.encrypt = function(cleartext, password, saltLength, p2c) {
    return encryptor.encrypt(cleartext, password, saltLength, p2c)
}
exports.decrypt = function(enc, password) {
    return encryptor.decrypt(enc, password)
}
