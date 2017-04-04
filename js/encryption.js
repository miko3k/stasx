"use strict";

var utf8 = require('./utf8')
var base64js_module = require('base64-js')
var log = require('./log')

var code = {
    BAD_PASSWORD: "BAD_PASSWORD",
    BAD_FORMAT: "BAD_FORMAT"
}

exports.code = code

exports.createEncrpytor = function(subtle, random) {
    var ALG = "PBES2-HS256+A128KW"
    var ENC = "A128CBC-HS256"

    var base64url = {
        // https://tools.ietf.org/html/rfc7515#appendix-C
        toByteArray: function(what) {
            what = what.replace(/-/g, '+');
            what = what.replace(/_/g, '/');
            switch(what.length % 4) {
                case 0: break;
                case 1: throw new Error("illegal base64 string");
                case 2: what += "=="; break;
                case 3: what += "="; break;
            }
            return base64js_module.toByteArray(what)
        },
        fromByteArray: function(what) {
            what = base64js_module.fromByteArray(what)
            what = what.split('=')[0];
            what = what.replace(/\+/g, '-');
            what = what.replace(/\//g, '_');
            return what;
        }
    }

    function appendBytes() {
        for(var i = 0; i < arguments.length; ++i) {
            var arg = arguments[i];

            if(typeof arg == "number") {
                arg = new Uint8Array([arg]);
            } else if(arg instanceof Uint8Array) {
                ;
            } else if(arg instanceof ArrayBuffer) {
                // ArrayBuffer cannot be passed to set
                arg = new Uint8Array(arg);
            } else {
                throw new Error("unappendable: " + typeof arg)
            }

            arguments[i] = arg;
        }

        var totallen = 0
        for(var i = 0; i < arguments.length; ++i) {
            totallen += arguments[i].length;
        }
        var result = new Uint8Array(totallen);
        totallen = 0;
        for(var i = 0; i < arguments.length; ++i) {
            result.set(arguments[i], totallen)
            totallen += arguments[i].length;
        }
        return result;
    }

    function arrayCmp(a,b) {
        if(a.length != b.length)
            return false;

        for(var i = 0; i < a.length; ++i) {
            if(a[i] != b[i])
                return false;
        }
        return true;
    }


    function formatSalt(alg, p2s) {
        return appendBytes(utf8.toByteArray(alg), 0, p2s);
    }

    function dumpKey(key, msg) {
        /*
        if(!msg) msg = "Key:"

        subtle.exportKey('raw', key).then(function(raw) {
            log(msg, new Uint8Array(raw));
        });*/
    }

    function aadLen(len) {
        var buf = new ArrayBuffer(8)
        var dv = new DataView(buf)
        dv.setUint32(4, len*8)// AAD length in bits
        return buf;
    }

    function decrypt(enc, password) {
        return new Promise(function(resolve, reject) {
            var parts = enc.trim().split('.')

            if(parts.length != 5) {
                log("file should have 5 parts")
                return reject(code.BAD_FORMAT)
            }
            var header = JSON.parse(utf8.fromByteArray(base64url.toByteArray(parts[0])))

            if(header.zip) {
                log("compression is not supported: " + header.zip)
                return reject(code.BAD_FORMAT)
            }

            if(header.alg != ALG) {
                log("unsupported encryption")
                return reject(code.BAD_FORMAT)
            }
            if(header.enc != ENC) {
                log("unsupported encoding")
                return reject(code.BAD_FORMAT)
            }
            var p2c = parseInt(header.p2c);
            if(p2c === NaN || p2c <= 0) {
                log("invalid or missing p2c")
                return reject(code.BAD_FORMAT)
            }
            var enckey = base64url.toByteArray(parts[1]);
            var initv = base64url.toByteArray(parts[2]);
            var ciphertext = base64url.toByteArray(parts[3]);
            var tag = base64url.toByteArray(parts[4]);
            var salt = formatSalt(header.alg, base64url.toByteArray(header.p2s));

            var hmacInput = function() {
                var aad = utf8.toByteArray(parts[0])

                return appendBytes(
                        aad,
                        initv,
                        ciphertext,
                        aadLen(aad.length));
            }()

            var contentKey
            return subtle.importKey(
                'raw',
                utf8.toByteArray(password),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            ).then(function(key) {
                return subtle.deriveKey(
                    {
                        "name": 'PBKDF2',
                        "salt": salt,
                        "iterations": p2c,
                        "hash": 'SHA-256'
                    },
                    key,
                    { "name": 'AES-KW', "length": 128 },
                    false,
                    ["wrapKey", "unwrapKey"])
            }).then(function(key) {
                return subtle.unwrapKey(
                        "raw",
                        enckey,
                        key,
                        "AES-KW",
                        "AES-CBC",
                        true,
                        ["encrypt", "decrypt"])
            }).then(function(key) {
                return subtle.exportKey('raw', key);
            }).then(function(rawkey) {
                contentKey = rawkey; // save for later

                return subtle.importKey(
                    'raw',
                    contentKey.slice(0,16),
                    { name: 'HMAC', hash: "SHA-256" },
                    false,
                    ['sign', 'verify'])
            }).then(function(mackey) {

                return subtle.sign(
                    "HMAC",
                    mackey,
                    hmacInput)
            }).then(function(mac) {
                mac = new Uint8Array(mac, 0, 16);
                if(!arrayCmp(mac, tag)) {
                    throw new Error("tag does not match");
                } else {
                    return subtle.importKey(
                        'raw',
                        contentKey.slice(16,32),
                        'AES-CBC',
                        false,
                        ['encrypt', 'decrypt'])
                }
            }).then(function(key) {
                return subtle.decrypt(
                        {
                            name: 'AES-CBC',
                            iv: initv
                        },
                        key,
                        ciphertext);
            }).then(function(plain) {
                return resolve(utf8.fromByteArray(new Uint8Array(plain)));
            }).catch(function(e) {
                // uh, this should be far more specific!
                return reject(code.BAD_PASSWORD);
            });
        });
    }


    function encrypt(cleartext, password, saltLength, p2c) {
        return new Promise(function(resolve, reject) {
            var p2s = new Uint8Array(saltLength);
            var iv = new Uint8Array(16);
            random(p2s);
            random(iv);
            var salt = formatSalt(ALG, p2s);

            var wrappingKey
            var enckey
            var contentKey
            var ciphertext

            var header = {
                p2s: base64url.fromByteArray(p2s),
                p2c: p2c,
                enc: ENC,
                alg: ALG
            };
            var headerStr = JSON.stringify(header);
            var headerb64 = base64url.fromByteArray(utf8.toByteArray(headerStr))

            return subtle.importKey(
                'raw',
                utf8.toByteArray(password),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            ).then(function(key) {
                return subtle.deriveKey(
                    {
                        "name": 'PBKDF2',
                        "salt": salt,
                        "iterations": p2c,
                        "hash": 'SHA-256'
                    },
                    key,
                    { "name": 'AES-KW', "length": 128 },
                    true,
                    ["wrapKey", "unwrapKey"])
            }).then(function(key) {
                wrappingKey = key;

                contentKey = new Uint8Array(32);
                random(contentKey);

                return subtle.importKey(
                    'raw',
                    contentKey,
                    'AES-CBC',
                    true,
                    [ 'encrypt', 'decrypt' ] );
            }).then(function(key) {
                dumpKey(key ,"imported contentKey");
                return subtle.wrapKey(
                    'raw',
                    key,
                    wrappingKey,
                    'AES-KW' );
            }).then(function(wrappedCek) {
                enckey = new Uint8Array(wrappedCek);

                var b64 = base64url.fromByteArray(enckey);

                return subtle.importKey(
                    'raw',
                    contentKey.slice(16,32),
                    'AES-CBC',
                    false,
                    ['encrypt', 'decrypt'])
            }).then(function(aeskey) {
                return subtle.encrypt(
                        {
                            name: 'AES-CBC',
                            iv: iv.buffer
                        },
                        aeskey,
                        utf8.toByteArray(cleartext).buffer);
            }).then(function(ctext) {
                ciphertext = new Uint8Array(ctext);

                return subtle.importKey(
                    'raw',
                    contentKey.slice(0,16),
                    { name: 'HMAC', hash: "SHA-256" },
                    false,
                    ['sign', 'verify'])
            }).then(function(mackey) {

                var aad = utf8.toByteArray(headerb64)

                var hmacInput = appendBytes(
                        aad,
                        iv,
                        ciphertext,
                        aadLen(aad.length));

                return subtle.sign(
                    "HMAC",
                    mackey,
                    hmacInput)
            }).then(function(mac) {
                mac = new Uint8Array(mac, 0, 16);

                resolve(headerb64 + "." +
                        base64url.fromByteArray(enckey) + "." +
                        base64url.fromByteArray(iv) + "." +
                        base64url.fromByteArray(ciphertext) + "." +
                        base64url.fromByteArray(mac))
            }).catch(function(e) {
                return reject(e);
            });
        });
    }


    return {
        decrypt: decrypt,
        encrypt: encrypt
    }
}

exports.generatePassword = function(random, len) {
    var validChars = [
        { 'from': "a".charCodeAt(0), 'to': "z".charCodeAt(0) },
        { 'from': "A".charCodeAt(0), 'to': "Z".charCodeAt(0) },
        { 'from': "0".charCodeAt(0), 'to': "9".charCodeAt(0) }
    ];


    var res = '';
    var arr = new Uint8Array(len);
    var used = arr.length;
    // generate string character by character, mapping random
    // numbers to our range, numbers which are higher than range
    // are ignored

    while(res.length < len) {
        if(used >= arr.length) {
            random(arr);
            used = 0;
        }
        var x = arr[used]
        ++used;

        for(var idx = 0; idx < validChars.length; ++idx) {
            var cur = validChars[idx];
            var sz = cur.to - cur.from + 1;
            if(x < sz) {
                res += String.fromCharCode(cur.from + x);
                break;
            } else {
                x -= sz;
            }
        }
    }
    return res;
}
