/**
 * Google-interfacing part.
 *
 * This file uses Promises heavily. Google returned Theanbles and Promises are always wrapped into
 * browser-native promises, becasue they don't seem very compatible <https://developers.google.com/
 * api-client-library/javascript/features/promises>, i.e. Where is catch(..) method?
 */

"use strict";

var $ = require('jquery')
var log = require('./log')
var Str = require('./strings')
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
var CLIENT_ID = '688176587142-blblhf39t5c0ritkja5oorlctni8eagc.apps.googleusercontent.com';
// Array of API discovery doc URLs for APIs used by the quickstart
var DEVELOPER_KEY = 'AIzaSyAyDS0TdG30_Akv5OCfKAuxz1apBhMFjNs';
var INSTALL_SCOPE = 'https://www.googleapis.com/auth/drive.install'
// Picker doesn't relly work without readonly, hm
var DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file'
var MAX_FILE_SIZE = 2*1024*1024 // we will simply refuse to open files bigger than this
var utf8 = require('./utf8')
var base64 = require('base64-js')
var Multipartish = require('multipartish')

var the_state = {
    auth_failed: false,
    auth_ready: false,
    signed_in: false,
    ui_integrated: null
}

Object.seal(the_state)

var the_state_listener = null

function fireAndForget(thenable) {
    thenable.then(function() {log("ok")}, function(err) { log(err) });
}

function changeState(change) {
    var something_changed = false
    $.each(change, function(key, value) {
        if(the_state[key] != value) {
            log("google state: " + key + " changed: ", value);
            the_state[key] = value
            something_changed = true
        }
    });
    if(the_state_listener && something_changed)
        the_state_listener(the_state)
}

var already_initialized = false
function doInitialization() {
    if(already_initialized)
        return

    already_initialized = true

    return new Promise(function(resolve, reject) {
        $.ajax({
            url: "https://apis.google.com/js/api.js",
            cache: true,
            dataType: "script"
        }).then(function() {
            resolve();
        }).fail(function(jqXHR, textStatus) {
            reject("Unable to load Google API: " + textStatus);
        })
    }).then(function() {
        return new Promise(function(resolve, reject) {
            // cannot see any way to handle errors here
            gapi.load("client:auth2:picker", resolve)
        })
    }).then(function() {
        return new Promise(function(resolve, reject) {
            return gapi.client.init({
                discoveryDocs: DISCOVERY_DOCS,
            }).then(function() {
                resolve()
            }, function(err) {
                log("rejected in gapi.client.init", err);
                var msg = err.message
                reject(msg)
            });
        })
    }).then(function() {
        return new Promise(function(resolve, reject) {
            gapi.auth2.init({
                fetch_basic_profile: false,
                client_id: CLIENT_ID,
                scope: DEFAULT_SCOPE
            }).then(function(auth) {
                var update_signed_in = function(is_signed_in) { changeState({signed_in: is_signed_in}) }
                var update_current_user = function(usr) {
                    changeState({ui_integrated: usr.hasGrantedScopes(INSTALL_SCOPE)})
                }

                changeState({auth_ready: true})

                auth.isSignedIn.listen(update_signed_in)
                auth.currentUser.listen(update_current_user)
                update_signed_in(auth.isSignedIn.get())
                update_current_user(auth.currentUser.get())

                resolve()
            }, function(arg) {
                log("rejected in gapi.auth2.init", arg);
                reject(arg.message || arg.error)
            })
        })
    }).then(function() {
        log("google initialized Ok");
    }).catch(function(err) {
        log("google init failed:", err);

        changeState({auth_failed: true})
    })
}

module.exports.init = function() {
    doInitialization()
}

/**
 * Registers a listener for changes in Google Drive state (logged in...),
 * there can be only one listener, to make memory leaks impossible (?)
 */
module.exports.setStateListener = function(listener) {
    the_state_listener = listener
}

/**
 * Returns Google Drive state
 */
module.exports.getState = function() {
    return the_state
}

module.exports.signIn = function() {
    fireAndForget(gapi.auth2.getAuthInstance().signIn())
}

module.exports.signOut = function() {
    fireAndForget(gapi.auth2.getAuthInstance().signOut())
}

function getCurrentUser() {
    if(!the_state.auth_ready)
        return null;

    return gapi.auth2.getAuthInstance().currentUser.get()
}

module.exports.integrateUi = function() {
    var usr = getCurrentUser()
    if(usr) {
        var options = new gapi.auth2.SigninOptionsBuilder({'scope': INSTALL_SCOPE});
        fireAndForget(usr.grant(options));
    }
}

function getCurrentToken() {
    var usr = getCurrentUser();
    if(usr) {
        var auth = usr.getAuthResponse();
        if(auth) {
            var result = auth.access_token
            return result;
        }
    }
    return null;
}

// https://gist.github.com/getify/7325764
function toArray(bStr) {
    var i, len = bStr.length, u8_array = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        u8_array[i] = bStr.charCodeAt(i);
    }
    return u8_array;
}

function fromArray(u8Array) {
    var i, len = u8Array.length, b_str = "";
    for (i=0; i<len; i++) {
        b_str += String.fromCharCode(u8Array[i]);
    }
    return b_str;
}

function parseBinary(str) {
    return utf8.fromByteArray(toArray(str))
}

function createBinary(str) {
    return fromArray(utf8.toByteArray(str))
}


module.exports.pick = function() {
    return new Promise(function(resolve, reject) {
        var view = new google.picker.DocsView()
        view.setMode(google.picker.DocsViewMode.LIST)

        var appid = CLIENT_ID.substr(0, CLIENT_ID.indexOf("-"))

        var token = getCurrentToken()

        var callback = function(data) {
            if(data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
                var doc = data[google.picker.Response.DOCUMENTS][0];
                var id = doc[google.picker.Document.ID]
                resolve(id)
            } else {
                // let's simply not resolve this
                // is it ok? <http://stackoverflow.com/questions/20068467/do-never-resolved-promises-cause-memory-leak>
            }
        }

        var picker = new google.picker.PickerBuilder().
            addView(view).
            setAppId(appid).
            setOAuthToken(token).
            setDeveloperKey(DEVELOPER_KEY).
            enableFeature(google.picker.Feature.NAV_HIDDEN).
            setCallback(callback).
            setTitle("Open a password file").
            build();

        picker.setVisible(true);
    }).then(function(id) {
        // size problably not returning by picker, so we will perform call to determine it
        return new Promise(function(resolve, reject) {
            gapi.client.drive.files.get({
                "fileId": id,
                "fields": "name,size"
            }).then(function(x) {
                var sstr = x.result.size

                if(!sstr)
                    reject("Not a binary file, cannot open")

                if(Number(sstr) > MAX_FILE_SIZE)
                    reject(Str.FILE_TOO_BIG)

                resolve({id:id, name:x.result.name})
            }, function(x) {
                log(x)
                reject("Unable to get file metadata: " + x.statusText)
            })
        })
    }).then(function(x) {

        return new Promise(function(resolve, reject) {
            gapi.client.drive.files.get({
                "fileId": x.id,
                "alt": "media"
            }).then(function(y) {
                resolve({
                    google_id: x.id,
                    name: x.name,
                    data: parseBinary(y.body)
                })
            }, function(x) {
                log(x)
                reject("Unable to get file content: " + x.statusText)
            })
        })
    })
}

module.exports.save = function(google_id, data) {
    return new Promise(function(resolve, reject) {
        gapi.client.request({
            'path': 'https://www.googleapis.com/upload/drive/v3/files/' + google_id,
            'method': 'PATCH',
            'params': {'uploadType': 'media'},
            'body': createBinary(data)
        }).then(function(x) {
            log(x.body)
            resolve()
        }, function(x) {
            log('error updating: ', x)
            reject("Error updating file: " + x.statusText)
        })
    })
}

module.exports.saveAs = function(filename, data) {
    log("save as: ", filename, ", data: ", data)

    return new Promise(function(resolve, reject) {
        var body = new Multipartish()
        body.header("Content-Type", "application/json; charset=UTF-8")
        body.part(createBinary(JSON.stringify({name: filename})))

        body.header("Content-Type", "application/octet-stream")
        body.part(createBinary(data))

        var request = body.get()
        log("request: ", request)

        gapi.client.request({
            'path': 'https://www.googleapis.com/upload/drive/v3/files',
            'method': 'POST',
            'params': {'uploadType': 'multipart'},
            'headers': {
                'Content-Type': body.contentType()
            },
            'body': request
        }).then(function(x) {
            var id = x.result.id
            log("successfuly saved file, id = ", id)
            resolve(id)
        }, function(x) {
            console.log(x)
            resolve("b")
        })
    })
}

